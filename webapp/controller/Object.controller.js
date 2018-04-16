/*global location*/
sap.ui.define([
	"counterparties/Counterparties/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"counterparties/Counterparties/model/formatter",
	'sap/m/MessageToast',
	'sap/m/MessageBox'
], function(
	BaseController,
	JSONModel,
	History,
	formatter,
	MessageToast,
	MessageBox
) {
	"use strict";

	return BaseController.extend("counterparties.Counterparties.controller.Object", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function() {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var iOriginalBusyDelay,
				oViewModel = new JSONModel({
					busy: true,
					delay: 0
				});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);

			// Store original busy indicator delay, so it can be restored later on
			iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			this.getView().setModel(oViewModel, "mMain");

			this.getOwnerComponent().getModel().metadataLoaded().then(function() {
				// Restore original busy indicator delay for the object view
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});

			// Define d = Dialog fragments inside view as depended of this view
			this.dRating = sap.ui.xmlfragment("fragment.rating", this);
			this.dRatingCredit = sap.ui.xmlfragment("fragment.creditLimit", this);
			this.dInsurance = sap.ui.xmlfragment("fragment.insuranceInformation", this);
			this.dBlacklist = sap.ui.xmlfragment("fragment.blacklist", this);
			this.dManagement = sap.ui.xmlfragment("fragment.management", this);
			this.dProxy = sap.ui.xmlfragment("fragment.proxy", this);
			this.dPolitical = sap.ui.xmlfragment("fragment.political", this);
			this.dRisk = sap.ui.xmlfragment("fragment.risk", this);
			this.getView().addDependent(this.dRating);
			this.getView().addDependent(this.dRatingCredit);
			this.getView().addDependent(this.dInsurance);
			this.getView().addDependent(this.dBlacklist);
			this.getView().addDependent(this.dManagement);
			this.getView().addDependent(this.dProxy);
			this.getView().addDependent(this.dPolitical);
			this.getView().addDependent(this.dRisk);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			var oViewModel = this.getModel("mMain"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});
			oShareDialog.open();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			var code = oEvent.getParameter("arguments").objectId;
			this.getModel().metadataLoaded().then(function() {
				this._bindView("/CounterpartyListSet('" + code + "')/ToCounterpartyHeader");
				
				// Disabled edit mode and hide edit buttons
				this.cancelMainInf();
			}.bind(this));
		},

		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function(url) {
			var oViewModel = this.getModel("mMain"),
				oDataModel = this.getModel();
			var that = this;
			
			this.getView().bindElement({
				path: url,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oDataModel.metadataLoaded().then(function() {
							// Busy indicator on view should only be set if metadata is loaded,
							// otherwise there may be two busy indications next to each other on the
							// screen. This happens because route matched handler already calls '_bindView'
							// while metadata is loaded.
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function() {
						that.byId('itbMain').setSelectedKey('dashboard');
						that.onTabSelected('dashboard', true);
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function() {
			var oView = this.getView(),
				oViewModel = this.getModel("mMain"),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oView.getBindingContext().getObject(),
				sObjectId = oObject.Code,
				sObjectName = oObject.Name;

			// Everything went fine.
			oViewModel.setProperty("/busy", false);
			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("saveAsTileTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));

			if (oObject.TypeID === '1') {
				this.hideObjects(["cGenInf"]);
			} else {
				this.showObjects(["cGenInf"]);
			}

			if (oObject.Sanctions) {
				this.showObjects(["isUnderSanction"]);
			} else {
				this.hideObjects(["isUnderSanction"]);
			}
		},

		// Upload additional information function
		handleUploadPress: function(oEvent) {
			var oFileUploader = this.getView().byId("fileUploader");
			if (!oFileUploader.getValue()) {
				MessageToast.show("Choose a file first");
				return;
			}
			oFileUploader.upload();
		},

		// On tabs selection function
		onTabSelected: function(key, update) {
			if(typeof key === "object"){
				key = key.getParameters("arguments").key;
			}
			var code = this.byId('tSAPID').getText();
			var partnerUrl = "/CounterpartyListSet('" + code + "')";
			
			if (key === "dashboard") {
				this.bindElement("blGenInf", partnerUrl + "/ToCounterpartyInformation", update);
				this.bindTable("addressTable", partnerUrl + "/ToCounterpartyAddressBook");
				this.bindTable("bankAccountTable", partnerUrl + "/ToCounterpartyBankAccounts");
				this.showObjects(["editMainInf"]);
			} else if(key === "government"){
				this.bindTable("managementTable", partnerUrl + "/ToGovernmentMgt");
				this.bindTable("proxyTable", partnerUrl + "/ToGovernmentProxy");
			} else if (key === "rating"){
				this.bindElement("blRatingGenInf", partnerUrl + "/ToRatingGeneral");
				this.bindTable("historicalDataTable", partnerUrl + "/ToRatingGeneralTab");
				this.bindElement("blCreditLimit", partnerUrl + "/ToRatingCreditLimit");
				this.bindTable("historicalDataTable2", partnerUrl + "/ToRatingCreditLimitTab");
				this.bindElement("blInsuranceInf", partnerUrl + "/ToRatingInsure");
			} else if (key === "risks"){
				this.bindTable("complianceRisksTable", partnerUrl + "/ToComplianceRisks");
				this.bindTable("politicalExposedTable", partnerUrl + "/CounterpartyListSet");
				this.bindElement("blcBlacklisted", partnerUrl + "/ToComplianceBlacklisted");
				this.bindTable("blacklistedInfTable", partnerUrl + "/ToComplianceBlacklistedTab");
			}
			
			if (key !== "dashboard") {
				this.cancelMainInf();
				this.hideObjects(["editMainInf"]);
			}
		},

		// Operations with updating counterparty rating
		showRating: function() {
			if (!sap.ui.getCore().byId('sRatingItem')) {
				sap.ui.getCore().byId('sRatingSelectScale').addItem(new sap.ui.core.Item("sRatingItem", {
					text: "",
					key: ""
				}));
				sap.ui.getCore().byId('sRatingSelectTransparency').addItem(new sap.ui.core.Item({
					text: "",
					key: ""
				}));
				sap.ui.getCore().byId('sRatingSelectFinProfile').addItem(new sap.ui.core.Item({
					text: "",
					key: ""
				}));
				sap.ui.getCore().byId('sRatingSelectComProfile').addItem(new sap.ui.core.Item({
					text: "",
					key: ""
				}));
				sap.ui.getCore().byId('sRatingSelectSet').addItem(new sap.ui.core.Item({
					text: "",
					key: ""
				}));
			}

			sap.ui.getCore().byId('sRatingSelectScale').setSelectedKey(this.byId("lBusinessScale").getText());
			sap.ui.getCore().byId('sRatingSelectTransparency').setSelectedKey(this.byId("lCorporateTransparency").getText());
			sap.ui.getCore().byId('sRatingSelectFinProfile').setSelectedKey(this.byId("lFinancialProfile").getText());
			sap.ui.getCore().byId('sRatingSelectComProfile').setSelectedKey(this.byId("lCommercialProfile").getText());
			sap.ui.getCore().byId('sRatingSelectSet').setSelectedKey(this.byId("lRatingSet").getText());
			sap.ui.getCore().byId('sRatingCheckboxScore').setSelected(this.byId("chExpressScore").getSelected());
			sap.ui.getCore().byId('dpRatingDate').setValue(this.byId("lRatingDate").data("key"));
			this.dRating.open();
		},

		updateRating: function() {
			var oModel = this.getModel();
			var date = sap.ui.getCore().byId('dpRatingDate').getDateValue();
			if(date) { date.setMinutes(-date.getTimezoneOffset()); }
			var code = this.byId("tSAPID").getText();
			var oData = {
				BusinessScale: sap.ui.getCore().byId('sRatingSelectScale').getSelectedKey(),
				CorporateTransparency: sap.ui.getCore().byId('sRatingSelectTransparency').getSelectedKey(),
				FinancialProfile: sap.ui.getCore().byId('sRatingSelectFinProfile').getSelectedKey(),
				CommercialProfile: sap.ui.getCore().byId('sRatingSelectComProfile').getSelectedKey(),
				RatingSet: sap.ui.getCore().byId('sRatingSelectSet').getSelectedKey(),
				ExpressScore: sap.ui.getCore().byId('sRatingCheckboxScore').getSelected(),
				Date: date,
				Code: code
			};
			oModel.create("/RatingGeneralSet", oData, {
				success: function(){
					this.bindElement("blRatingGenInf","/CounterpartyListSet('" + code + "')/ToRatingGeneral", true);
				},
				error: this.errorFunction.bind(this)
			});
			this.dRating.close();
		},

		// Operations with updating counterparty credit limit
		showCreditLimit: function() {
			sap.ui.getCore().byId('iCreditLimit').setValue(this.byId('lCreditLimit').data('creditLimit'));
			sap.ui.getCore().byId('sCreditLimitCurrency').setSelectedKey(this.byId('lCreditLimitCurrency').getText());
			sap.ui.getCore().byId('dCreditLimitPeriodFrom').setDateValue(this.byId('lCreditLimitValidityDate').data('validityDate'));
			this.dRatingCredit.open();
		},

		updateCreditLimit: function() {
			var oModel = this.getModel();
			var validityDate = sap.ui.getCore().byId('dCreditLimitPeriodFrom').getDateValue();
			if(validityDate) { validityDate.setMinutes(-validityDate.getTimezoneOffset()); }
			var code = this.byId("tSAPID").getText();
			var oData = {
				ValidityDate: validityDate,
				CreditLimit: sap.ui.getCore().byId('iCreditLimit').getValue(),
				Currency: sap.ui.getCore().byId('sCreditLimitCurrency').getSelectedKey(),
				Code: code
			};
			oModel.create("/RatingCreditLimitSet", oData, {
				success: function(){
					this.bindElement("blCreditLimit", "/CounterpartyListSet('" + code + "')/ToRatingCreditLimit", true);
				},
				error: this.errorFunction.bind(this)
			});
			this.dRatingCredit.close();
		},

		// Operations with updating counterparty Insurance information
		showInsuranceInf: function() {
			sap.ui.getCore().byId('iInsuranceReceivables').setValue(this.byId('lInsuranceReceivables').data('receivables'));
			sap.ui.getCore().byId('sInsuranceCurrency').setSelectedKey(this.byId('lInsuranceCurrency').getText());
			sap.ui.getCore().byId('iInsuranceRate').setValue(this.byId('lInsuranceRate').data('rate'));
			sap.ui.getCore().byId('iInsuranceContract').setValue(this.byId('lInsuranceContract').getText());
			sap.ui.getCore().byId('dInsuranceValidityDate').setDateValue(this.byId('lInsuraceValidityDate').data('validityDate'));
			this.dInsurance.open();
		},

		updateInsurance: function() {
			var oModel = this.getModel();
			var that = this;
			var dateTo = sap.ui.getCore().byId('dInsuranceValidityDate').getDateValue();
			if(dateTo) { dateTo.setMinutes(-dateTo.getTimezoneOffset()); }
			var code = this.byId("tSAPID").getText();
			var oData = {
				DateTo: dateTo,
				Amount: sap.ui.getCore().byId('iInsuranceReceivables').getValue(),
				Currency: sap.ui.getCore().byId('sInsuranceCurrency').getSelectedKey(),
				Rate: sap.ui.getCore().byId('iInsuranceRate').getValue(),
				Unit: "%",
				ContractNum: sap.ui.getCore().byId('iInsuranceContract').getValue(),
				Code: code
			};
			oModel.create("/RatingInsureSet", oData, {
				success: function(){
					that.bindElement("blInsuranceInf", "/CounterpartyListSet('" + code + "')/ToRatingInsure", true);
				},
				error: that.errorFunction.bind(that)
			});
			this.dInsurance.close();
		},

		// Operations with updating Blacklist
		showBlacklist: function() {
			sap.ui.getCore().byId('cbDialogBlacklist').setSelected(this.byId('cbBlacklist').getSelected());
			sap.ui.getCore().byId('taDialogJustification').setValue(this.byId('taBlacklistJustification').getValue());
			this.dBlacklist.open();
		},

		updateBlacklist: function() {
			var oModel = this.getModel();
			var that = this;
			var code = this.byId("tSAPID").getText();
			var oData = {
				DateFrom: new Date(),
				Justification: sap.ui.getCore().byId('taDialogJustification').getValue(),
				BlackListed: sap.ui.getCore().byId('cbDialogBlacklist').getSelected(),
				Code: code
			};
			oModel.create("/ComplianceBlacklistedSet", oData, {
				success: function(){
					this.bindElement("blcBlacklisted","/CounterpartyListSet('" + code + "')/ToComplianceBlacklisted", true);
				},
				error: that.errorFunction.bind(that)
			});
			this.dBlacklist.close();
		},

		// Success and error default functions for dialog CRUD functions 
		successFunction: function(event) {
			console.log("Success!", event);
		},
		errorFunction: function(event) {
			console.log("Error!", event);
		},

		// Delete,Add,Edit functions for Managament table from Government Tab
		tableAddManagement: function() {
			if (!sap.ui.getCore().byId('sManagementItem')) {
				sap.ui.getCore().byId('sManagementTypeOfGov').addItem(new sap.ui.core.Item("sManagementItem", {
					text: "",
					key: ""
				}));
			}
			sap.ui.getCore().byId('iManagementName').setValue("").setEnabled(true);
			sap.ui.getCore().byId('iManagementSurname').setValue("").setEnabled(true);
			sap.ui.getCore().byId('iManagementPosition').setValue("");
			sap.ui.getCore().byId('sManagementTypeOfGov').setSelectedKey("");
			sap.ui.getCore().byId('iManagementPhone').setValue("");
			sap.ui.getCore().byId('iManagementFax').setValue("");
			sap.ui.getCore().byId('iManagementEmail').setValue("");
			this.dManagement.setTitle(this.getModel("i18n").getProperty('addManagement'));
			this.dManagement.getButtons()[1].setVisible(false);
			this.dManagement.getButtons()[2].setVisible(true);
			this.dManagement.open();
		},

		tableEditManagement: function() {
			// Get data from row
			var cells = this.byId('managementTable').getSelectedItem().getCells();
			var cellsData = [];
			for (var i = 0; i < cells.length; i++) {
				if (cells[i].data("key")) {
					cellsData.push(cells[i].data("key"));
				} else {
					cellsData.push(cells[i].getText());
				}
			}

			// Set data from row to Risks edit Dialog
			sap.ui.getCore().byId('iManagementName').setValue(cellsData[0]).setEnabled(false);
			sap.ui.getCore().byId('iManagementSurname').setValue(cellsData[1]).setEnabled(false);
			sap.ui.getCore().byId('iManagementPosition').setValue(cellsData[2]);
			sap.ui.getCore().byId('sManagementTypeOfGov').setSelectedKey(cellsData[3]);
			sap.ui.getCore().byId('iManagementPhone').setValue(cellsData[4]);
			sap.ui.getCore().byId('iManagementFax').setValue(cellsData[5]);
			sap.ui.getCore().byId('iManagementEmail').setValue(cellsData[6]);

			// Change dialog settings and open it
			this.dManagement.setTitle(this.getModel("i18n").getProperty('editManagement'));
			this.dManagement.getButtons()[1].setVisible(true);
			this.dManagement.getButtons()[2].setVisible(false);
			this.dManagement.open();
		},

		tableDeleteManagement: function() {
			var that = this;
			var oModel = this.getModel();
			var url = this.byId('managementTable').getSelectedItem().getBindingContextPath();
			MessageBox.confirm("Are you sure you want to delete?", {
				actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
				onClose: function(sAction) {
					if (sAction === "Delete") {
						oModel.remove(url, {
							success: that.successFunction.bind(that),
							error: that.errorFunction.bind(that)
						});
					}
				}
			});
		},

		dialogAddManagement: function() {
			if (!sap.ui.getCore().byId('iManagementName').getValue() || !sap.ui.getCore().byId('iManagementSurname').getValue()) {
				MessageBox.alert(this.getModel('i18n').getResourceBundle().getText("enterNameSurname"), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			} else {
				var oModel = this.getModel();
				var oData = {
					Name: sap.ui.getCore().byId('iManagementName').getValue(),
					Surname: sap.ui.getCore().byId('iManagementSurname').getValue(),
					Position: sap.ui.getCore().byId('iManagementPosition').getValue(),
					GoverType: sap.ui.getCore().byId('sManagementTypeOfGov').getSelectedKey(),
					Phone: sap.ui.getCore().byId('iManagementPhone').getValue(),
					FaxNumber: sap.ui.getCore().byId('iManagementFax').getValue(),
					Email: sap.ui.getCore().byId('iManagementEmail').getValue(),
					GoverName: "",
					Code: this.byId("tSAPID").getText()
				};
				oModel.create("/GovernmentMgtSet", oData, {
					success: this.successFunction.bind(this),
					error: this.errorFunction.bind(this)
				});
				this.dManagement.close();
			}
		},

		dialogEditManagement: function() {
			var oModel = this.getModel();
			var url = this.byId('managementTable').getSelectedItem().getBindingContextPath();
			var oData = {
				Name: sap.ui.getCore().byId('iManagementName').getValue(),
				Surname: sap.ui.getCore().byId('iManagementSurname').getValue(),
				Position: sap.ui.getCore().byId('iManagementPosition').getValue(),
				GoverType: sap.ui.getCore().byId('sManagementTypeOfGov').getSelectedKey(),
				GoverName: "",
				Phone: sap.ui.getCore().byId('iManagementPhone').getValue(),
				FaxNumber: sap.ui.getCore().byId('iManagementFax').getValue(),
				Email: sap.ui.getCore().byId('iManagementEmail').getValue(),
				Code: this.byId("tSAPID").getText()
			};
			oModel.update(url, oData, {
				success: this.successFunction.bind(this),
				error: this.errorFunction.bind(this)
			});
			this.dManagement.close();
		},

		// Delete,Add,Edit functions for Proxy table from Government Tab
		tableAddProxy: function() {
			sap.ui.getCore().byId('iProxyName').setValue("").setEnabled(true);
			sap.ui.getCore().byId('iProxySurname').setValue("").setEnabled(true);
			sap.ui.getCore().byId('iProxyPosition').setValue("");
			sap.ui.getCore().byId('taProxyComment').setValue("");
			sap.ui.getCore().byId('iProxyPhone').setValue("");
			sap.ui.getCore().byId('iProxyFax').setValue("");
			sap.ui.getCore().byId('iProxyEmail').setValue("");
			this.dProxy.setTitle(this.getModel("i18n").getProperty('addProxy'));
			this.dProxy.getButtons()[1].setVisible(false);
			this.dProxy.getButtons()[2].setVisible(true);
			this.dProxy.open();
		},

		tableEditProxy: function() {
			// Get data from row
			var cells = this.byId('proxyTable').getSelectedItem().getCells();
			var cellsData = [];
			for (var i = 0; i < cells.length; i++) {
				cellsData.push(cells[i].getText());
			}

			// Set data from row to Risks edit Dialog
			sap.ui.getCore().byId('iProxyName').setValue(cellsData[0]).setEnabled(false);
			sap.ui.getCore().byId('iProxySurname').setValue(cellsData[1]).setEnabled(false);
			sap.ui.getCore().byId('iProxyPosition').setValue(cellsData[2]);
			sap.ui.getCore().byId('taProxyComment').setValue(cellsData[3]);
			sap.ui.getCore().byId('iProxyPhone').setValue(cellsData[4]);
			sap.ui.getCore().byId('iProxyFax').setValue(cellsData[5]);
			sap.ui.getCore().byId('iProxyEmail').setValue(cellsData[6]);

			// Edit proxy dialog settings
			this.dProxy.setTitle(this.getModel("i18n").getProperty('editProxy'));
			this.dProxy.getButtons()[1].setVisible(true);
			this.dProxy.getButtons()[2].setVisible(false);
			this.dProxy.open();
		},

		tableDeleteProxy: function() {
			var that = this;
			var oModel = this.getModel();
			var url = this.byId('proxyTable').getSelectedItem().getBindingContextPath();
			MessageBox.confirm("Are you sure you want to delete?", {
				actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
				onClose: function(sAction) {
					if (sAction === "Delete") {
						oModel.remove(url, {
							success: that.successFunction.bind(that),
							error: that.errorFunction.bind(that)
						});
					}
				}
			});
		},

		dialogAddProxy: function() {
			if (!sap.ui.getCore().byId('iProxyName').getValue() || !sap.ui.getCore().byId('iProxySurname').getValue()) {
				MessageBox.alert(this.getModel('i18n').getResourceBundle().getText("enterNameSurname"), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			} else {
				var oModel = this.getModel();
				var oData = {
					Name: sap.ui.getCore().byId('iProxyName').getValue(),
					Surname: sap.ui.getCore().byId('iProxySurname').getValue(),
					Position: sap.ui.getCore().byId('iProxyPosition').getValue(),
					Comment: sap.ui.getCore().byId('taProxyComment').getValue(),
					Phone: sap.ui.getCore().byId('iProxyPhone').getValue(),
					FaxNumber: sap.ui.getCore().byId('iProxyFax').getValue(),
					Email: sap.ui.getCore().byId('iProxyEmail').getValue(),
					Code: this.byId("tSAPID").getText()
				};
				oModel.create("/GovernmentProxySet", oData, {
					success: this.successFunction.bind(this),
					error: this.errorFunction.bind(this)
				});
				this.dProxy.close();
			}
		},

		dialogEditProxy: function() {
			var oModel = this.getModel();
			var url = this.byId('proxyTable').getSelectedItem().getBindingContextPath();
			var oData = {
				Name: sap.ui.getCore().byId('iProxyName').getValue(),
				Surname: sap.ui.getCore().byId('iProxySurname').getValue(),
				Position: sap.ui.getCore().byId('iProxyPosition').getValue(),
				Comment: sap.ui.getCore().byId('taProxyComment').getValue(),
				Phone: sap.ui.getCore().byId('iProxyPhone').getValue(),
				FaxNumber: sap.ui.getCore().byId('iProxyFax').getValue(),
				Email: sap.ui.getCore().byId('iProxyEmail').getValue(),
				Code: this.byId("tSAPID").getText()
			};
			oModel.update(url, oData, {
				success: this.successFunction.bind(this),
				error: this.errorFunction.bind(this)
			});
			this.dProxy.close();
		},

		// Delete,Add,Edit functions for Complience Risks table from Compliance Risks Tab
		tableAddRisk: function() {
			if (!sap.ui.getCore().byId('sRiskItem')) {
				sap.ui.getCore().byId('sRiskRiskType').addItem(new sap.ui.core.Item("sRiskItem", {
					text: "",
					key: ""
				}));
			}
			sap.ui.getCore().byId('sRiskRiskType').setSelectedKey("").setEnabled(true);
			sap.ui.getCore().byId('taRiskDescription').setValue("");
			sap.ui.getCore().byId('taRiskRecommended').setValue("");
			sap.ui.getCore().byId('dpRiskDateFrom').setDateValue(null).setEnabled(true);
			sap.ui.getCore().byId('dpRiskDateTo').setDateValue(null);
			sap.ui.getCore().byId('cbRiskActual').setSelected(false);
			this.dRisk.setTitle(this.getModel("i18n").getProperty('addRisk'));
			this.dRisk.getButtons()[1].setVisible(false);
			this.dRisk.getButtons()[2].setVisible(true);
			this.dRisk.open();
		},

		tableEditRisk: function() {
			var cells = this.byId('complianceRisksTable').getSelectedItem().getCells();
			var cellsData = [];
			for (var i = 0; i < cells.length; i++) {
				if (cells[i].data("key")){
					cellsData.push(cells[i].data("key"));
				}else if (cells[i]['mBindingInfos'].text) {
					cellsData.push(cells[i].getText());
				} else {
					cellsData.push(cells[i].getSelected());
				}
			}

			// Set data from row to Risks edit Dialog
			sap.ui.getCore().byId('sRiskRiskType').setSelectedKey(cellsData[0]).setEnabled(false);
			sap.ui.getCore().byId('taRiskDescription').setValue(cellsData[1]);
			sap.ui.getCore().byId('taRiskRecommended').setValue(cellsData[2]);
			sap.ui.getCore().byId('dpRiskDateFrom').setDateValue(cellsData[3]).setEnabled(false);
			if (cellsData[4] === "") {
				cellsData[4] = null;
			}
			sap.ui.getCore().byId('dpRiskDateTo').setDateValue(cellsData[4]);
			sap.ui.getCore().byId('cbRiskActual').setSelected(cellsData[5]);

			// Edit risks dialog
			this.dRisk.setTitle(this.getModel("i18n").getProperty('editRisk'));
			this.dRisk.getButtons()[1].setVisible(true);
			this.dRisk.getButtons()[2].setVisible(false);
			this.dRisk.open();
		},

		tableDeleteRisk: function() {
			var that = this;
			var oModel = this.getModel();
			var url = this.byId('complianceRisksTable').getSelectedItem().getBindingContextPath();
			MessageBox.confirm("Are you sure you want to delete?", {
				actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
				onClose: function(sAction) {
					if (sAction === "Delete") {
						oModel.remove(url, {
							success: that.successFunction.bind(that),
							error: that.errorFunction.bind(that)
						});
					}
				}
			});
		},

		dialogAddRisk: function() {
			if (!sap.ui.getCore().byId('sRiskRiskType').getSelectedKey() || !sap.ui.getCore().byId('dpRiskDateFrom').getDateValue()) {
				MessageBox.alert(this.getModel('i18n').getResourceBundle().getText("enterTypeItemNumberDateFrom"), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			} else {
				var oModel = this.getModel();
				var dateFrom = sap.ui.getCore().byId('dpRiskDateFrom').getDateValue();
				var dateTo = sap.ui.getCore().byId('dpRiskDateTo').getDateValue();
				dateFrom.setMinutes(-dateFrom.getTimezoneOffset());
				if(dateTo) { dateTo.setMinutes(-dateTo.getTimezoneOffset()); }
				var oData = {
					RiskType: sap.ui.getCore().byId('sRiskRiskType').getSelectedKey(),
					ItemNumber: "1",
					DateFrom: dateFrom,
					Type: "",
					Description: sap.ui.getCore().byId('taRiskDescription').getValue(),
					Actions: sap.ui.getCore().byId('taRiskRecommended').getValue(),
					DateTo: dateTo,
					Actual: sap.ui.getCore().byId('cbRiskActual').getSelected(),
					Code: this.byId("tSAPID").getText()
				};
				oModel.create("/ComplianceRisksSet", oData, {
					success: this.successFunction.bind(this),
					error: this.errorFunction.bind(this)
				});
				this.dRisk.close();
			}
		},

		dialogEditRisk: function() {
			if (!sap.ui.getCore().byId('sRiskRiskType').getSelectedKey() || !sap.ui.getCore().byId('dpRiskDateFrom').getDateValue()) {
				MessageBox.alert(this.getModel('i18n').getResourceBundle().getText("enterTypeItemNumberDateFrom"), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			} else {
				var oModel = this.getModel();
				var url = this.byId('complianceRisksTable').getSelectedItem().getBindingContextPath();
				var dateTo = sap.ui.getCore().byId('dpRiskDateTo').getDateValue();
				if(dateTo) { dateTo.setMinutes(-dateTo.getTimezoneOffset()); }
				var oData = {
					RiskType: sap.ui.getCore().byId('sRiskRiskType').getSelectedKey(),
					ItemNumber: "1",
					DateFrom: sap.ui.getCore().byId('dpRiskDateFrom').getDateValue(),
					Type: "",
					Description: sap.ui.getCore().byId('taRiskDescription').getValue(),
					Actions: sap.ui.getCore().byId('taRiskRecommended').getValue(),
					DateTo: dateTo,
					Actual: sap.ui.getCore().byId('cbRiskActual').getSelected(),
					Code: this.byId("tSAPID").getText()
				};
				oModel.update(url, oData, {
					success: this.successFunction.bind(this),
					error: this.errorFunction.bind(this)
				});
				this.dRisk.close();
			}
		},

		// Delete,Add,Edit functions for Political Exposed person table from Compliance Risks Tab
		tableAddPolitical: function() {
			sap.ui.getCore().byId('iPoliticalName').setValue("").setEnabled(true);
			sap.ui.getCore().byId('iPoliticalSurname').setValue("").setEnabled(true);
			sap.ui.getCore().byId('iPoliticalPosition').setValue("");
			sap.ui.getCore().byId('taPoliticalComment').setValue("");
			sap.ui.getCore().byId('iPoliticalPhone').setValue("");
			sap.ui.getCore().byId('iPoliticalFax').setValue("");
			sap.ui.getCore().byId('iPoliticalEmail').setValue("");
			this.dPolitical.setTitle(this.getModel("i18n").getProperty('addPolitical'));
			this.dPolitical.getButtons()[1].setVisible(false);
			this.dPolitical.getButtons()[2].setVisible(true);
			this.dPolitical.open();
		},

		tableEditPolitical: function() {
			// Get data from row
			var cells = this.byId('politicalExposedTable').getSelectedItem().getCells();
			var cellsData = [];
			for (var i = 0; i < cells.length; i++) {
				cellsData.push(cells[i].getText());
			}

			// Set data from row to Risks edit Dialog
			sap.ui.getCore().byId('iPoliticalName').setValue(cellsData[0]).setEnabled(false);
			sap.ui.getCore().byId('iPoliticalSurname').setValue(cellsData[1]).setEnabled(false);
			sap.ui.getCore().byId('iPoliticalPosition').setValue(cellsData[2]);
			sap.ui.getCore().byId('taPoliticalComment').setValue(cellsData[3]);
			sap.ui.getCore().byId('iPoliticalPhone').setValue(cellsData[4]);
			sap.ui.getCore().byId('iPoliticalFax').setValue(cellsData[5]);
			sap.ui.getCore().byId('iPoliticalEmail').setValue(cellsData[6]);

			// Edit Political Exposed person dialog settings
			this.dPolitical.setTitle(this.getModel("i18n").getProperty('editPolitical'));
			this.dPolitical.getButtons()[1].setVisible(true);
			this.dPolitical.getButtons()[2].setVisible(false);
			this.dPolitical.open();
		},

		tableDeletePolitical: function() {
			var that = this;
			var oModel = this.getModel();
			var url = this.byId('politicalExposedTable').getSelectedItem().getBindingContextPath();
			MessageBox.confirm("Are you sure you want to delete?", {
				actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
				onClose: function(sAction) {
					if (sAction === "Delete") {
						oModel.remove(url, {
							success: that.successFunction.bind(that),
							error: that.errorFunction.bind(that)
						});
					}
				}
			});
		},

		dialogAddPolitical: function() {
			if (!sap.ui.getCore().byId('iPoliticalName').getValue() || !sap.ui.getCore().byId('iPoliticalSurname').getValue()) {
				MessageBox.alert(this.getModel('i18n').getResourceBundle().getText("enterNameSurname"), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			} else {
				var oModel = this.getModel();
				var oData = {
					Name: sap.ui.getCore().byId('iPoliticalName').getValue(),
					Surname: sap.ui.getCore().byId('iPoliticalSurname').getValue(),
					Position: sap.ui.getCore().byId('iPoliticalPosition').getValue(),
					Comment: sap.ui.getCore().byId('taPoliticalComment').getValue(),
					Phone: sap.ui.getCore().byId('iPoliticalPhone').getValue(),
					FaxNumber: sap.ui.getCore().byId('iPoliticalFax').getValue(),
					Email: sap.ui.getCore().byId('iPoliticalEmail').getValue(),
					Code: this.byId("tSAPID").getText()
				};
				oModel.create("/CompliancePersonsSet", oData, {
					success: this.successFunction.bind(this),
					error: this.errorFunction.bind(this)
				});
				this.dPolitical.close();
			}
		},

		dialogEditPolitical: function() {
			var oModel = this.getModel();
			var url = this.byId('politicalExposedTable').getSelectedItem().getBindingContextPath();
			var oData = {
				Name: sap.ui.getCore().byId('iPoliticalName').getValue(),
				Surname: sap.ui.getCore().byId('iPoliticalSurname').getValue(),
				Position: sap.ui.getCore().byId('iPoliticalPosition').getValue(),
				Comment: sap.ui.getCore().byId('taPoliticalComment').getValue(),
				Phone: sap.ui.getCore().byId('iPoliticalPhone').getValue(),
				FaxNumber: sap.ui.getCore().byId('iPoliticalFax').getValue(),
				Email: sap.ui.getCore().byId('iPoliticalEmail').getValue(),
				Code: this.byId("tSAPID").getText()
			};
			oModel.update(url, oData, {
				success: this.successFunction.bind(this),
				error: this.errorFunction.bind(this)
			});
			this.dPolitical.close();
		},
		
		// Edit function of Main Information (Dashboard tab)
		editMainInf: function(){
			this.hideObjects(["lMainInfLegalForm", "lMainInfLimitSecurity", "lMainInfValidityDate", "editMainInf", "lMainInfCurrency"]);
			this.showObjects(["iMainInfLegalForm", "iMainInfLimitSecurity", "dpMainInfValidityDate", "saveMainInf", "cancelMainInf", "sMainInfCurrency"]);
			this.enableObjects(["fuMainInfFileUpload", "bMainInfFileUpload"]);
		},
		
		// Save function of Main Information (Dashboard tab)
		saveMainInf: function(){
			this.cancelMainInf();
		},
		
		// Cancel function of Main Information (Dashboard tab)
		cancelMainInf: function(){
			this.hideObjects(["iMainInfLegalForm", "iMainInfLimitSecurity", "dpMainInfValidityDate", "saveMainInf", "cancelMainInf", "sMainInfCurrency"]);
			this.showObjects(["lMainInfLegalForm", "lMainInfLimitSecurity", "lMainInfValidityDate", "editMainInf", "lMainInfCurrency"]);
			this.disableObjects(["fuMainInfFileUpload", "bMainInfFileUpload"]);
		},

		// On select item in Compliance Risks table
		onRiskSelect: function(e) {
			var listItems = e.getParameters("listItem");
			if (listItems) {
				// Make enabed edit buttons
				this.byId('bDeleteRisk').setEnabled(true);
				this.byId('bEditRisk').setEnabled(true);
			}
		},

		// On select item in Political Exposed Person table
		onPersonChange: function(e) {
			var listItems = e.getParameters("listItem");
			if (listItems) {
				// Make enabed edit buttons
				this.byId('bDeletePolitical').setEnabled(true);
				this.byId('bEditPolitical').setEnabled(true);
			}
		},

		// On select item in Political Exposed Person table
		onManagementChange: function(e) {
			var listItems = e.getParameters("listItem");
			if (listItems) {
				// Make enabed edit buttons
				this.byId('bDeleteManagement').setEnabled(true);
				this.byId('bEditManagement').setEnabled(true);
			}
		},

		// On select item in Political Exposed Person table
		onProxyChange: function(e) {
			var listItems = e.getParameters("listItem");
			if (listItems) {
				// Make enabed edit buttons
				this.byId('bDeleteProxy').setEnabled(true);
				this.byId('bEditProxy').setEnabled(true);
			}
		},

		// Close dialog function
		closeDialog: function(e) {
			var dialog = e.getSource().data('dialog');
			this[dialog].close();
		},
		
		// General Hide function | objects: array of ids of objects
		hideObjects: function(objects){
			for(var i in objects){
				this.byId(objects[i]).setVisible(false);
			}
		},
		
		// General Show function | objects: array of ids of objects
		showObjects: function(objects){
			for(var i in objects){
				this.byId(objects[i]).setVisible(true);
			}
		},
		
		// General Enable function | objects: array of ids of objects
		enableObjects: function(objects){
			for(var i in objects){
				this.byId(objects[i]).setEnabled(true);
			}
		},
		
		// General Disable | objects: array of ids of objects
		disableObjects: function(objects){
			for(var i in objects){
				this.byId(objects[i]).setEnabled(false);
			}
		},
		
		// Bind table function for all tables
		// tableId = id of table, url = full path of binding
		bindTable: function(tableId, url){
			var oTable = this.byId(tableId);
			if(oTable.mBindingInfos.items.path !== url){
				oTable.bindItems({
					path: url,
					template: oTable['mBindingInfos'].items.template
				});
			}
		},
		
		// Bind element function for all elements
		// tableId = id of element, url = full path of binding, update = flag if the operation is update
		bindElement: function(elementId, url, update){
			var oElement = this.byId(elementId);
			if(Object.keys(oElement.mElementBindingContexts).length === 0 || update){
				oElement.bindElement(url);
			}
		}
	});

});