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
				this.code = code;
				// Disabled edit mode and hide edit buttons
				this.cancelMainInf();
				
				// Set Relations BP
				var that = this;
				var relationModel = new JSONModel();
				var modelLink = this.getModel().sServiceUrl;
				relationModel.loadData(modelLink + "/CounterpartyListSet('" + this.code + "')/ToBPRelationships");
				relationModel.attachRequestCompleted(function(){
					var items = this.getData().d.results;
					var isParent = [];
					var isChild = [];
					for(var i in items){
						if(items[i].IsParent){
							isParent.push(items[i]);
						}else{
							isChild.push(items[i]);
						}
					}
					that.setRelations(isParent, "relationBPParent");
					that.setRelations(isChild, "relationBPChild");
					relationModel.detachRequestCompleted(this);
				});
			}.bind(this));
		},
		
		// Relations BP function
		setRelations: function(array, id){
			var flexBox = this.byId(id);
			var innerFlexBox = this.byId(id + "Flex");
			innerFlexBox.removeAllItems();
			if(array.length > 0){
				flexBox.setVisible(true);
				for(var i in array){
					var link = new sap.m.Link({
						text: array[i].RelatedCode + " - " + array[i].RelatedBPName,
						href: "/CounterpartyHeaderSet/" + array[i].RelatedCode,
						wrapping: true
					});
					innerFlexBox.addItem(link);
				}
			}else{
				flexBox.setVisible(false);
			}
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
			
			this.byId("mainElement").bindElement({
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
			var oElement = this.byId("mainElement"),
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
				this.setVisible(["cGenInf"], false);
			} else {
				this.setVisible(["cGenInf"], true);
			}

			if (oObject.Sanctions) {
				this.setVisible(["isUnderSanction"], true);
			} else {
				this.setVisible(["isUnderSanction"], false);
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
				this.bindElement("generalElement", partnerUrl + "/ToCounterpartyInformation", update);
				this.bindTable("addressTable", partnerUrl + "/ToCounterpartyAddressBook");
				this.bindTable("bankAccountTable", partnerUrl + "/ToCounterpartyBankAccounts");
				this.setVisible(["editMainInf"], true);
			} else if(key === "government"){
				this.bindTable("managementTable", partnerUrl + "/ToGovernmentMgt");
				this.bindTable("proxyTable", partnerUrl + "/ToGovernmentProxy");
			} else if (key === "rating"){
				this.bindElement("ratingElement", partnerUrl + "/ToRatingGeneral");
				this.bindTable("historicalDataTable", partnerUrl + "/ToRatingGeneralTab");
				this.bindElement("creditLimitElement", partnerUrl + "/ToRatingCreditLimit");
				this.bindTable("historicalDataTable2", partnerUrl + "/ToRatingCreditLimitTab");
				this.bindElement("insuranceInformationElement", partnerUrl + "/ToRatingInsure");
			} else if (key === "risks"){
				this.bindTable("risksTable", partnerUrl + "/ToComplianceRisks");
				this.bindTable("politicalTable", partnerUrl + "/ToCompliancePersons");
				this.bindElement("blacklistElement", partnerUrl + "/ToComplianceBlacklisted");
				this.bindTable("blacklistedInfTable", partnerUrl + "/ToComplianceBlacklistedTab");
				this.bindElement("risksCountryElement", partnerUrl + "/ToCounterpartyHeader");
			}
			
			if (key !== "dashboard") {
				this.cancelMainInf();
				this.setVisible(["editMainInf"], false);
			}
		},
		
		// Success and error default functions for dialog CRUD functions 
		successFunction: function(event) {
			console.log("Success!", event);
		},
		errorFunction: function(event) {
			console.log("Error!", event);
		},
		
		// Edit function of Main Information (Dashboard tab)
		editMainInf: function(){
			this.setVisible(["lMainInfLegalForm", "lMainInfLimitSecurity", "lMainInfDateValidity", "editMainInf", "lMainInfCurrency"], false);
			this.setVisible(["iMainInfLegalForm", "iMainInfLimitSecurity", "dpMainInfDateValidity", "saveMainInf", "cancelMainInf", "sMainInfCurrency"], true);
			this.setEnabled(["fuMainInfFileUpload", "bMainInfFileUpload"], true);
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
					that.bindElement("generalElement", "/CounterpartyListSet('" + code + "')/ToCounterpartyInformation", true);
				},
				error: that.errorFunction.bind(that)
			});
			this.cancelMainInf();
		},
		
		// Cancel function of Main Information (Dashboard tab)
		cancelMainInf: function(){
			this.setVisible(["iMainInfLegalForm", "iMainInfLimitSecurity", "dpMainInfDateValidity", "saveMainInf", "cancelMainInf", "sMainInfCurrency"], false);
			this.setVisible(["lMainInfLegalForm", "lMainInfLimitSecurity", "lMainInfDateValidity", "editMainInf", "lMainInfCurrency"], true);
			this.setEnabled(["fuMainInfFileUpload", "bMainInfFileUpload"], false);
		},

		// On select item in Compliance Risks table
		onTableSelect: function(e){
			var listItems = e.getParameters("listItem");
			if (listItems) {
				var id = e.getSource().data("id");
				this.setEnabled([id + "Delete", id + "Edit"], true);
			}
		},
		
		// General Show function | objects: array of ids of objects
		setVisible: function(objects, flag){
			for(var i in objects){
				if(this.byId(objects[i])){
					this.byId(objects[i]).setVisible(flag);
				}
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
			this.setDialogEnabled(oDialog, true);
			oDialog.getButtons()[1].setVisible(false);
			oDialog.getButtons()[2].setVisible(true);
		},
		tableEdit: function(oEvent) {
			var id = oEvent.getSource().data("id");
			var url = this.byId(id + "Table").getSelectedItem().getBindingContextPath();
			sap.ui.getCore().byId(id + "Dialog").bindElement(url);
			var oDialog = this.dialogOpen(oEvent);
			this.setDialogEnabled(oDialog, false);
			oDialog.getButtons()[1].setVisible(true);
			oDialog.getButtons()[2].setVisible(false);
		},
		tableDelete: function(oEvent) {
			var sTableId = oEvent.getSource().data("id");
			var oTable = this.byId(sTableId + "Table");
			var sUrl = oTable.getSelectedItem().getBindingContextPath();
			var oModel = oTable.getModel();
			var that = this;
			MessageBox.confirm("Are you sure you want to delete?", {
				actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
				onClose: function(sAction) {
					if (sAction === "Delete") {
						oModel.remove(sUrl,{
							success: function(){
								if(oTable.getItems().length === 0){
									that.setEnabled([sTableId + "Delete", sTableId + "Edit"], false);
								}
							}
						});
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
			var bCheckAlert = this.checkKeys(oDialog);
			var sUrl = oButton.data("url");
			if(bCheckAlert === "Please, enter"){
				oModel.create(sUrl, oData);
				this[sTableId + "Dialog"].close();
			}else{
				MessageBox.alert(bCheckAlert.slice(0, -2), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			}
		},
		dialogEdit: function(oEvent) {
			var id = oEvent.getSource().data("id");
			var isCreate = oEvent.getSource().data("create");
			var oDialog = sap.ui.getCore().byId(id + "Dialog");
			var url = oDialog.getBindingContext().getPath();
			var oModel = this.getView().getModel();
			var oData = this.getOdata(oDialog);
			oDialog.unbindElement();
			if(isCreate){
				var that = this;
				var expandUrl = oEvent.getSource().data("expandUrl");
				url = oEvent.getSource().data("url");
				var elementUrl = "/CounterpartyListSet('" + this.code + "')" + expandUrl;
				oModel.create(url, oData, {
					success: function(){
						that.bindElement(id + "Element", elementUrl, true);
					}	
				});
			}else{
				oModel.update(url, oData);
			}
			this[id + "Dialog"].close();
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
		setDialogEnabled: function(oDialog, flag){
			var inputs = oDialog.getAggregation("content");
			for(var i in inputs){
				if(inputs[i].data("key")){
					inputs[i].setEnabled(flag);
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
			oData.Code = this.code;
			return oData;
		},
		
		// Checks the key values to lock them on update
		checkKeys: function(oDialog){
			var check = this.getModel('i18n').getResourceBundle().getText("plsEnter");
			var inputs = oDialog.getAggregation("content");
			for(var i in inputs){
				var oInput = inputs[i];
				if(oInput.data("key")){
					if((oInput.mProperties.hasOwnProperty("value") && !oInput.getValue()) || 
					(oInput.mProperties.hasOwnProperty("selectedKey") && !oInput.getSelectedKey()) ||
					(oInput.mBindingInfos.hasOwnProperty("value") && !oInput.getValue()) ||
					(oInput.hasOwnProperty("_oMaxDate") && !oInput.getDateValue())){
						//if(oInput.data("omitKey") === null){
							check = check + " " + oInput.data("key") + ", ";
						//}
					}
				}
			}
			return check;
		},
		
		// Enable/Disables inputs depending flag arg
		setEnabled: function(idArr, flag){
			for(var i in idArr){
				if(this.byId(idArr[i])){
					this.byId(idArr[i]).setEnabled(flag);
				}
			}
		},
		
		// Edit element function
		elementEdit: function(oEvent){
			var id = oEvent.getSource().data("id");
			var oElement = this.byId(id + "Element");
			if(oElement.getBindingContext()){
				var url = this.byId(id + "Element").getBindingContext().getPath();
				sap.ui.getCore().byId(id + "Dialog").bindElement(url);
			}
			this[id + "Dialog"].open();
		}
	});
});