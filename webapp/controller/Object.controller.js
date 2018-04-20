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
			
			this.dialogArr =  ["rating", "creditLimit", "insuranceInformation", "blacklist", "management", "proxy", "political", "risks"];
			this.addDialogs(this.dialogArr);
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
			
			this.byId("blMainInf").bindElement({
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
			var oElement = this.byId("blMainInf"),
				oViewModel = this.getModel("mMain"),
				oElementBinding = oElement.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}

			var oResourceBundle = this.getResourceBundle(),
				oObject = oElement.getBindingContext().getObject(),
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
				this.bindTable("risksTable", partnerUrl + "/ToComplianceRisks");
				this.bindTable("politicalTable", partnerUrl + "/ToCompliancePersons");
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
			this.ratingDialog.open();
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
			this.ratingDialog.close();
		},

		// Operations with updating counterparty credit limit
		showCreditLimit: function() {
			sap.ui.getCore().byId('iCreditLimit').setValue(this.byId('lCreditLimit').data('creditLimit'));
			sap.ui.getCore().byId('sCreditLimitCurrency').setSelectedKey(this.byId('lCreditLimitCurrency').getText());
			sap.ui.getCore().byId('dCreditLimitPeriodFrom').setDateValue(this.byId('lCreditLimitValidityDate').data('validityDate'));
			this.creditLimitDialog.open();
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
			this.creditLimitDialog.close();
		},

		// Operations with updating counterparty Insurance information
		showInsuranceInf: function() {
			sap.ui.getCore().byId('iInsuranceReceivables').setValue(this.byId('lInsuranceReceivables').data('receivables'));
			sap.ui.getCore().byId('sInsuranceCurrency').setSelectedKey(this.byId('lInsuranceCurrency').getText());
			sap.ui.getCore().byId('iInsuranceRate').setValue(this.byId('lInsuranceRate').data('rate'));
			sap.ui.getCore().byId('iInsuranceContract').setValue(this.byId('lInsuranceContract').getText());
			sap.ui.getCore().byId('dInsuranceValidityDate').setDateValue(this.byId('lInsuraceValidityDate').data('validityDate'));
			this.insuranceInformationDialog.open();
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
			this.insuranceInformationDialog.close();
		},

		// Operations with updating Blacklist
		showBlacklist: function() {
			sap.ui.getCore().byId('cbDialogBlacklist').setSelected(this.byId('cbBlacklist').getSelected());
			sap.ui.getCore().byId('taDialogJustification').setValue(this.byId('taBlacklistJustification').getValue());
			this.blacklistDialog.open();
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
			this.blacklistDialog.close();
		},

		// Success and error default functions for dialog CRUD functions 
		successFunction: function(event) {
			console.log("Success!", event);
		},
		errorFunction: function(event) {
			console.log("Error!", event);
			this.getModel().refresh();
		},
		
		// Edit function of Main Information (Dashboard tab)
		editMainInf: function(){
			this.hideObjects(["lMainInfLegalForm", "lMainInfLimitSecurity", "lMainInfDateValidity", "editMainInf", "lMainInfCurrency"]);
			this.showObjects(["iMainInfLegalForm", "iMainInfLimitSecurity", "dpMainInfDateValidity", "saveMainInf", "cancelMainInf", "sMainInfCurrency"]);
			this.enableObjects(["fuMainInfFileUpload", "bMainInfFileUpload"]);
		},
		
		// Save function of Main Information (Dashboard tab)
		saveMainInf: function(){
			var oModel = this.getModel();
			var DateValidity = new Date(this.byId('dpMainInfDateValidity').getValue());
			if(DateValidity) { DateValidity.setMinutes(-DateValidity.getTimezoneOffset()); }
			var code = this.byId("tSAPID").getText();
			var oData = {
				DateValidity: DateValidity,
				Currency: this.byId('sMainInfCurrency').getSelectedKey(),
				LimitSecurity: this.byId('iMainInfLimitSecurity').getValue(),
				RelationBP: this.byId('lMainInfRelationBP').getText(),
				RelationCategory: this.byId('lMainInfRelationCategory').getText(),
				RegistrationNumber: this.byId('lMainInfRegistrationNumber').getText(),
				EnglishName: this.byId('lMainInfEnglishName').getText(),
				LegalName: this.byId('lMainInfLegalName').getText(),
				LegalForm: this.byId('iMainInfLegalForm').getValue(),
				Identifier: this.byId('lMainInfIdentifier').getText(),
				Code: code
			};
			var that = this;
			oModel.create("/CounterpartyInformationSet", oData, {
				success: function(){
					that.bindElement("blGenInf", "/CounterpartyListSet('" + code + "')/ToCounterpartyInformation", true);
				},
				error: that.errorFunction.bind(that)
			});
			this.cancelMainInf();
		},
		
		// Cancel function of Main Information (Dashboard tab)
		cancelMainInf: function(){
			this.hideObjects(["iMainInfLegalForm", "iMainInfLimitSecurity", "dpMainInfDateValidity", "saveMainInf", "cancelMainInf", "sMainInfCurrency"]);
			this.showObjects(["lMainInfLegalForm", "lMainInfLimitSecurity", "lMainInfDateValidity", "editMainInf", "lMainInfCurrency"]);
			this.disableObjects(["fuMainInfFileUpload", "bMainInfFileUpload"]);
		},

		// On select item in Compliance Risks table
		onTableSelect: function(e){
			var listItems = e.getParameters("listItem");
			if (listItems) {
				var id = e.getSource().data("id");
				this.byId(id + "Delete").setEnabled(true);
				this.byId(id + "Edit").setEnabled(true);
			}
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
		},
		
		// Add all dialog xml fragments to this view as dependent, tableArr: array of string ids of tables
		addDialogs: function(tableArr){
			for(var i in tableArr){
				// Just in case if any of the dialog fragment has syntax error
				try {
					this[tableArr[i] + "Dialog"] = sap.ui.xmlfragment("fragment." + tableArr[i] + "Dialog", this);
					this.getView().addDependent(this[tableArr[i] + "Dialog"]);
				} catch (err) {
					console.log("Error in dialog with ID: " + this.tableArr[i] + "Dialog");
				}
				
			}
		},
		
		// Table buttons function for add/edit/delete of items
		tableAdd: function(oEvent) {
			var id = oEvent.getSource().data("id");
			sap.ui.getCore().byId(id + "Dialog").unbindElement();
			var oDialog = this.dialogOpen(oEvent);
			this.setEnabled(oDialog, true);
			oDialog.getButtons()[1].setVisible(false);
			oDialog.getButtons()[2].setVisible(true);
		},
		tableEdit: function(oEvent) {
			var id = oEvent.getSource().data("id");
			var url = this.byId(id + "Table").getSelectedItem().getBindingContextPath();
			sap.ui.getCore().byId(id + "Dialog").bindElement(url);
			var oDialog = this.dialogOpen(oEvent);
			this.setEnabled(oDialog, false);
			oDialog.getButtons()[1].setVisible(true);
			oDialog.getButtons()[2].setVisible(false);
		},
		tableDelete: function(oEvent) {
			var sTableId = oEvent.getSource().data("id");
			var oTable = this.byId(sTableId + "Table");
			var sUrl = oTable.getSelectedItem().getBindingContextPath();
			var oModel = oTable.getModel();
			MessageBox.confirm("Are you sure you want to delete?", {
				actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
				onClose: function(sAction) {
					if (sAction === "Delete") {
						oModel.remove(sUrl);
					} else {
						MessageToast.show("Delete canceled!");
					}
				}
			});
		},
		
		// Add/Edit/Close dialog functions
		dialogAdd: function(oEvent) {
			var oButton = oEvent.getSource();
			var sTableId = oButton.data("id");
			var oDialog = oButton.getParent();
			var oModel = oDialog.getModel();
			var oData = this.getOdata(oDialog);
			var bCheck = this.checkKeys(oDialog);
			var sUrl = this.byId(sTableId + "Table").getItems()[0].getBindingContextPath();
			sUrl = sUrl.slice(0, sUrl.indexOf("("));
			if(bCheck){
				oModel.create(sUrl, oData);
				this[sTableId + "Dialog"].close();
			}else{
				MessageBox.alert(this.getModel('i18n').getResourceBundle().getText("enterNameSurnameContact"), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			}
		},
		dialogEdit: function(oEvent) {
			var sTableId = oEvent.getSource().data("id");
			var oDialog = sap.ui.getCore().byId(sTableId + "Dialog");
			var sUrl = oDialog.getBindingContext().getPath();
			var oModel = oDialog.getModel();
			var oData = this.getOdata(oDialog);
			oModel.update(sUrl, oData);
			this[sTableId + "Dialog"].close();
		},
		dialogClose: function(e) {
			var dialog = e.getSource().data('id');
			this[dialog].close();
		},
		
		// Function for openning the dialog for create/edit/copy functions
		// Also returns dialog object
		dialogOpen: function(oEvent) {
			var sTableId = oEvent.getSource().data("id");
			this[sTableId + "Dialog"].open();
			return this[sTableId + "Dialog"];
		},
		
		// Set key inputs as disabled/enabled for editting, oDialog = object dialog, flag = boolean flag for enabled/disabled
		setEnabled: function(oDialog, flag){
			var inputs = oDialog.getAggregation("content");
			for(var i in inputs){
				if(inputs[i].data("key")){
					if(flag){
						inputs[i].setEnabled(true);
					}else{
						inputs[i].setEnabled(false);
					}
				}
			}
		},
		
		// Set odata from any dialog, oDialog = object dialog / return object Data
		getOdata: function(oDialog){
			var oData = {};
			var inputs = oDialog.getAggregation("content");
			for(var i in inputs){
				if(inputs[i].data("value") !== null){
					oData[inputs[i].getBindingInfo("value").binding.sPath] = inputs[i].data("value");
				}else if(inputs[i].hasOwnProperty("_oMaxDate")){
					var date = inputs[i].getDateValue();
					if(date) {
						date.setMinutes(-date.getTimezoneOffset());
					} else { 
						date = null;
					}
					oData[inputs[i].getBindingInfo("dateValue").binding.sPath] = date;
				}else if(inputs[i].getBindingInfo("value")){
					oData[inputs[i].getBindingInfo("value").binding.sPath] = inputs[i].getValue();
				}else if(inputs[i].getBindingInfo("selectedKey")){
					oData[inputs[i].getBindingInfo("selectedKey").binding.sPath] = inputs[i].getSelectedKey();
				}else if(inputs[i].getBindingInfo("selected")){
					oData[inputs[i].getBindingInfo("selected").binding.sPath] = inputs[i].getSelected();
				}
			}
			oData.Code = this.byId("tSAPID").getText();
			return oData;
		},
		
		// Checks the key values to lock them on update
		checkKeys: function(oDialog){
			var check = true;
			var inputs = oDialog.getAggregation("content");
			for(var i in inputs){
				var oInput = inputs[i];
				if(oInput.data("key")){
					if(oInput.mProperties.hasOwnProperty("value") && !oInput.getValue()){
						check = false;
					}else if(oInput.mProperties.hasOwnProperty("selectedKey") && !oInput.getSelectedKey()){
						check = false;
					}else if(oInput.mBindingInfos.hasOwnProperty("value") && !oInput.getValue()){
						check = false;
					}
				}
			}
			return check;
		}
	});
});