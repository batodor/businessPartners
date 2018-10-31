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
			this.typeArr = ["value", "dateValue", "selectedKey", "selected"];
			
			this.dialogArr =  ["rating", "creditLimit", "insuranceInformation", "blacklist", "management", "proxy", "political", "risks", "upload", "uploadDashboard", 
				"managementContacts", "contacts", "contacts2", "proxyContacts", "politicalContacts"];
			this.addDialogs(this.dialogArr);
			this.access = true;
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
				var url = this.getModel().sServiceUrl + "/CounterpartyListSet('" + this.code + "')/ToBPRelationships?$format=json";
				var that = this;
				$.ajax({
				    url: url,
				    type: 'GET',
				    success: function(data){ 
				        var items = data.d.results;
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
				    }
				});
				
				// Access control
                this.checkUserAccess();
                this.onTabSelected(this.byId("itbMain").getSelectedKey());
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

		// On tabs selection function
		onTabSelected: function(key) {
			if(typeof key === "object"){
				key = key.getParameters("arguments").key;
			}
			this.partnerUrl = "/CounterpartyListSet('" + this.code + "')";
			
			if (key === "dashboard") {
				var that = this;
				this.byId("generalElement").bindElement({
					path: this.partnerUrl + "/ToCounterpartyInformation",
					events: {
						dataReceived: function(oEvent) {
							var data = oEvent.getParameter("data");
							if(data){
								that.Unlimited = data.Unlimited;
								that.LimitSecurity = data.LimitSecurity;
							}
						}
					}
				});
				this.bindTable("addressTable", this.partnerUrl + "/ToCounterpartyAddressBook");
				this.bindTable("bankAccountTable", this.partnerUrl + "/ToCounterpartyBankAccounts");
				var uploadFilter = [{ path: "DocType", operator: "EQ", value: '6'}];
				this.bindTable("uploadDashboardTable", this.partnerUrl + "/ToAttachments", false, uploadFilter);
			} else if(key === "government"){
				this.bindTable("managementTable", this.partnerUrl + "/ToGovernmentMgt");
				this.bindTable("proxyTable", this.partnerUrl + "/ToGovernmentProxy");
			} else if (key === "rating"){
				this.bindElement("ratingElement", this.partnerUrl + "/ToRatingGeneral");
				this.bindTable("historicalDataTable", this.partnerUrl + "/ToRatingGeneralTab");
				this.bindElement("creditLimitElement", this.partnerUrl + "/ToRatingCreditLimit");
				this.bindTable("historicalDataTable2", this.partnerUrl + "/ToRatingCreditLimitTab");
				this.bindElement("insuranceInformationElement", this.partnerUrl + "/ToRatingInsure");
			} else if (key === "risks"){
				this.bindTable("risksTable", this.partnerUrl + "/ToComplianceRisks");
				this.bindTable("politicalTable", this.partnerUrl + "/ToCompliancePersons");
				this.bindElement("blacklistElement", this.partnerUrl + "/ToComplianceBlacklisted");
				this.bindTable("blacklistedInfTable", this.partnerUrl + "/ToComplianceBlacklistedTab");
				this.bindElement("risksCountryElement", this.partnerUrl + "/ToCounterpartyHeader");
			} else if (key === "attachments"){
				this.bindTable("uploadTable", this.partnerUrl + "/ToAttachments");
			}
			
			this.byId("editMainInf").setVisible(this.access);
			
			if (key !== "dashboard") {
				this.cancelMainInf();
				this.setVisible(["editMainInf"], false);
			}
		},
		
		// Check user access
		checkUserAccess: function(){
			this.getModel().callFunction("/GetUserFunctions", {
				method: "GET",
				success: this.onCheckUserAccessSuccess.bind(this, "GetUserFunctions")
			});
		},
        // Check user access - processing result
		onCheckUserAccessSuccess: function(link, oData) {
			var oResult = oData[link];
			this.access = oResult.Action === "W" ? true : false; // R
			for(var i = 0; i < this.dialogArr.length; i++){
				var id = this.dialogArr[i];
				var buttons = this[id+"Dialog"].getButtons();
				for(var j = 1; j < buttons.length; j++){
			    	buttons[j].setVisible(this.access);
				}
				if(id !== "uploadDashboard"){
					this.setVisible([id + "Add", id + "Edit", id + "Delete", id + "Update"], this.access);
				}
			}
		},

		// Relations BP function
		setRelations: function(array, id){
			var that = this;
			var flexBox = this.byId(id);
			var innerFlexBox = this.byId(id + "Flex");
			innerFlexBox.removeAllItems();
			if(array.length > 0){
				flexBox.setVisible(true);
				for(var i in array){
					var link = new sap.m.Link({
						text: array[i].RelatedCode + " - " + array[i].RelatedBPName,
						press: function(oEvent){
							var code = oEvent.getSource().data("code");
							that.getRouter().navTo("object", {
								objectId: code
							});
						},
						wrapping: true
					});
					link.data("code", array[i].RelatedCode);
					innerFlexBox.addItem(link);
				}
			}else{
				flexBox.setVisible(false);
			}
		},
		
		// Edit function of Main Information (Dashboard tab)
		editMainInf: function(){
			this.setVisible(["lMainInfLegalForm", "lMainInfLimitSecurity", "lMainInfDateValidity", "editMainInf", "lMainInfCurrency"], false);
			this.setVisible(["iMainInfLegalForm", "iMainInfLimitSecurity", "dpMainInfDateValidity", "saveMainInf", "cancelMainInf", "sMainInfCurrency", 
				"uploadDashboardAdd", "uploadDashboardDelete"], true);
			if(this.unlimited){
				this.byId("iMainInfLimitSecurity").setEnabled(false);
				this.byId("sMainInfCurrency").setEnabled(false);
			}else{
				this.byId("iMainInfLimitSecurity").setEnabled(true);
				this.byId("sMainInfCurrency").setEnabled(true);
			}
			this.byId("unlimited").setEnabled(true);
		},
		
		// Save function of Main Information (Dashboard tab)
		saveMainInf: function(){
			var oModel = this.getModel();
			var DateValidity = this.byId('dpMainInfDateValidity').getDateValue() || this.byId('dpMainInfDateValidity').getValue();
			if(DateValidity) {
				if(typeof DateValidity === "string"){
					DateValidity = new Date(DateValidity);
				}
				DateValidity.setMinutes(-DateValidity.getTimezoneOffset());
				var code = this.byId("tSAPID").getText();
				var oData = {
					DateValidity: DateValidity,
					Currency: this.byId('sMainInfCurrency').getSelectedKey(),
					LimitSecurity: this.byId('iMainInfLimitSecurity').getValue(),
					RelationCategory: "",
					RegistrationNumber: this.byId('lMainInfRegistrationNumber').getText(),
					EnglishName: this.byId('lMainInfEnglishName').getText(),
					LegalName: this.byId('lMainInfLegalName').getText(),
					LegalForm: this.byId('iMainInfLegalForm').getValue(),
					Identifier: this.byId('lMainInfIdentifier').getText(),
					Unlimited: this.byId('unlimited').getSelected(),
					Code: code
				};
				var that = this;
				oModel.create("/CounterpartyInformationSet", oData, {
					success: function(){
						that.bindElement("generalElement", "/CounterpartyListSet('" + code + "')/ToCounterpartyInformation", true);
					}
				});
				this.cancelMainInf();
			}else{
				MessageToast.show(this.getModel('i18n').getResourceBundle().getText("plsEnter") + ' ' + this.getModel('i18n').getResourceBundle().getText("validityDate"));
			}
		},
		
		// Cancel function of Main Information (Dashboard tab)
		cancelMainInf: function(){
			this.setVisible(["iMainInfLegalForm", "iMainInfLimitSecurity", "dpMainInfDateValidity", "saveMainInf", "cancelMainInf", "sMainInfCurrency", "uploadDashboardAdd", 
				"uploadDashboardDelete"], false);
			this.setVisible(["lMainInfLegalForm", "lMainInfLimitSecurity", "lMainInfDateValidity", "editMainInf", "lMainInfCurrency"], true);
			this.byId("unlimited").setEnabled(false).setSelected(this.Unlimited);
			this.byId("iMainInfLimitSecurity").setValue(this.LimitSecurity);
		},
		
		onCheckBox: function(oEvent){
			var selected = oEvent.getParameter("selected");
			if(selected){
				this.byId("iMainInfLimitSecurity").setValue("0");
			}
			this.byId("iMainInfLimitSecurity").setEnabled(!selected);
			this.byId("sMainInfCurrency").setEnabled(!selected);
		},

		// On select item in Compliance Risks table
		onTableSelect: function(e){
			var listItems = e.getParameters("listItem");
			if (listItems) {
				var id = e.getSource().data("id");
				this.setEnabled([id + "Delete", id + "Edit", id + "Download", id + "Contacts"], true);
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
		// id = id of table, url = full path of binding
		// Update boolean force to update
		// argFilters array of objects, each object contain path, operator and value for Filters.
		bindTable: function(id, url, argFilters){
			var table = this.byId(id) || sap.ui.getCore().byId(id);
			var parameters = {
				path: url,
				template: table['mBindingInfos'].items.template
			};
			if(argFilters && argFilters[0].path){
				var filters = [];
				for(var i = 0; i < argFilters.length; i++){
					var filter = new sap.ui.model.Filter(argFilters[i].path, sap.ui.model.FilterOperator[argFilters[i].operator], argFilters[i].value);
					filters.push(filter);
				}
				parameters.filters = filters;
			}else if(argFilters && argFilters[0].sPath){
				parameters.filters = argFilters;
			}
			table.bindItems(parameters);
		},
		
		// Bind element function for all elements
		// tableId = id of element, url = full path of binding, update = flag if the operation is update
		bindElement: function(elementId, url, update){
			var oElement = this.byId(elementId);
			if(Object.keys(oElement.mElementBindingContexts).length === 0 || (oElement.getBindingContext() && oElement.getBindingContext().getPath() !== url) || update){
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
					console.log("Error in dialog with ID: " + tableArr[i] + "Dialog");
				}
				
			}
		},

		// Table buttons function for add/edit/delete of items
		tableAdd: function(oEvent) {
			var button = oEvent.getSource();
			var id = button.data("id");
			
			var oDialog = this.dialogOpen(oEvent);
			
			oDialog.getButtons()[1].setVisible(false);
			oDialog.getButtons()[2].setVisible(true);
			
			if(button.data("url")){
				oDialog.getButtons()[2].data("url",button.data("url"));
			}
			if(button.data("table")){
				var url = sap.ui.getCore().byId(button.data("table") + "Dialog").getBindingContext().getPath();
				oDialog.bindElement(url);
				this.setDialogEnabled(oDialog, false);
			}else{
				this.setDialogEnabled(oDialog, true);
				oDialog.unbindElement();
			}
			// If upload table set token to uploader
			if(button.data("upload")){
				var uploader = this.byId(button.data("upload")) || sap.ui.getCore().byId(button.data("upload"));
				uploader.oFilePath.setValue(""); 
				var select = this.byId(id + "Select") || sap.ui.getCore().byId(id + "Select");
				if(select){
					select.setSelectedKey("");
				}
				var model = this.getModel();
				var oData = { token: model.getSecurityToken() };
				// if select predefined, then defines url too
	            if(button.data("select")){
	            	var selectedKey = button.data("select");
					select.setEnabled(false).setSelectedKey(selectedKey);
					var url = this.getModel().sServiceUrl + "/AttachHelperSet(PartnerCode='" + this.code + "',DocType='" + selectedKey + "')/ToAttachments";
					oData.uploadUrl = url;
				}
				var uploadModel = new JSONModel(oData);
				uploader.setModel(uploadModel,"upload");
			}
		},
		tableEdit: function(oEvent) {
			var button = oEvent.getSource();
			var id = button.data("id");
			var table = button.data("table") ? this.byId(button.data("table") + "Table") || sap.ui.getCore().byId(button.data("table") + "Table") : 
				this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
			if(table.getSelectedItem()){
				var url = table.getSelectedItem().getBindingContextPath();
				var dialog = this.dialogOpen(oEvent);
				dialog.unbindElement();
				dialog.bindElement(url);
				this.setDialogEnabled(dialog, false);
				if(!button.data("dialog")){
					dialog.getButtons()[1].setVisible(true);
					dialog.getButtons()[2].setVisible(false);
				}
				
				// If upload table set token to uploader
				if(button.data("upload")){
					var uploader = this.byId(button.data("upload")) || sap.ui.getCore().byId(button.data("upload"));
					uploader.oFilePath.setValue("");
					var model = this.getModel();
					var oData = { token: model.getSecurityToken() };
					var uploadModel = new JSONModel(oData);
					uploader.setModel(uploadModel,"upload");
				}
			}else{
				MessageToast.show("Choose an item to edit/delete.");
			}
		},
		tableDelete: function(oEvent) {
			var button = oEvent.getSource();
			var id = button.data("id");
			var table = button.data("table") ? this.byId(button.data("table") + "Table") || sap.ui.getCore().byId(button.data("table") + "Table") : 
				this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
			var url = table.getSelectedItem().getBindingContextPath();
			
			// If upload table change the delete url
			if(button.data("upload")){
				url = url + "/$value";
			}
			
			var model = table.getModel();
			var that = this;
			MessageBox.confirm("Are you sure you want to delete?", {
				actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
				onClose: function(sAction) {
					if (sAction === "Delete") {
						model.remove(url,{
							success: function(){
								if(table.getItems().length === 0){
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
			var button = oEvent.getSource();
			var id = button.data("id");
			var dialog = button.getParent();
			var model = dialog.getModel();
			var oData = this.getOdata(dialog);
			var bCheckAlert = this.checkKeys(dialog);
			var sUrl = button.data("url");
			var settings = {};
			if(button.data("upload")){
				var uploader = this.byId(button.data("upload")) || sap.ui.getCore().byId(button.data("upload"));
				settings.success = function(oData, response) {
					if(uploader.getValue()){
						var uploadUrl = button.data("uploadUrl");
						var responseUrl = response.headers.location;
						var serviceUrl = uploader.getModel().sServiceUrl;
						var fullUrl = serviceUrl + responseUrl.split(serviceUrl)[1] + uploadUrl;
						uploader.setUploadUrl(fullUrl);
						uploader.upload();
					}
				};
			}
			if(bCheckAlert === "Please, enter"){
				model.create(sUrl, oData, settings);
				dialog.unbindElement();
				this[id + "Dialog"].close();
			}else{
				MessageBox.alert(bCheckAlert.slice(0, -2), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			}
		},
		dialogEdit: function(oEvent) {
			var button = oEvent.getSource();
			var id = button.data("id");
			var isCreate = id === "blacklist" && this.byId("blacklistElement").getBindingContext() ? false : button.data("create");
			var dialog = sap.ui.getCore().byId(id + "Dialog");
			var url = dialog.getBindingContext() ? dialog.getBindingContext().getPath() : '';
			var model = this.getView().getModel();
			var oData = this.getOdata(dialog);
			var bCheckAlert = this.checkKeys(dialog);
			if(bCheckAlert === "Please, enter"){
				if(button.data("upload")){
					var uploader = this.byId(button.data("upload")) || sap.ui.getCore().byId(button.data("upload"));
					if(uploader.getValue()){
						var uploadUrl = button.data("uploadUrl");
						uploader.setUploadUrl(model.sServiceUrl + url + uploadUrl);
						uploader.upload();
					}
				}
				dialog.unbindElement();
				var settings = {};
				var that = this;
				var expandUrl = button.data("expandUrl");
				var elementUrl = "/CounterpartyListSet('" + this.code + "')" + expandUrl;
				if(isCreate){
					url = button.data("url");
					settings.success = function(){
						that.bindElement(id + "Element", elementUrl, true);
					};
					model.create(url, oData, settings);
				}else{
					if(id === "blacklist" && this.byId("blacklistElement").getBindingContext()){
						settings.success = function(){
							that.bindElement(id + "Element", elementUrl, true);
						};
					}
					model.update(url, oData, settings);
				}
				this[id + "Dialog"].close();
			}else{
				MessageBox.alert(bCheckAlert.slice(0, -2), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			}
		},
		dialogClose: function(e) {
			var id = e.getSource().data('id');
			this.clearValues(this[id]);
			this[id].close();
		},
		
		clearValues: function(object){
			var inputs = object.getAggregation("content");
			for(var i = 0; i < inputs.length; i++){
				for(var j = 0; j < this.typeArr.length; j++){
					var input = inputs[i];
					var type = this.typeArr[j];
					if(input.mProperties.hasOwnProperty(type)){
						var evalStr = 'input.set' + type.charAt(0).toUpperCase() + type.substr(1) + '("")';
						if(type === "dateValue"){
							var evalStr = 'input.setDateValue(null)';
						}
						eval(evalStr);
					}
				}
			}
		},
		
		// Function for openning the dialog for create/edit/copy functions
		// Also returns dialog object
		dialogOpen: function(oEvent) {
			var context = oEvent.getSource();
			var id = context.data("dialog") ? context.data("dialog") : context.data("id");
			this[id + "Dialog"].open();
			return this[id + "Dialog"];
		},
		
		// Set key inputs as disabled/enabled for editting, oDialog = object dialog, flag = boolean flag for enabled/disabled
		setDialogEnabled: function(oDialog, flag){
			var inputs = oDialog.getAggregation("content");
			for(var i in inputs){
				if(inputs[i].data("key") && !inputs[i].data("omitKey")){
					inputs[i].setEnabled(flag);
				}
			}
		},
		
		// Set odata from any dialog, oDialog = object dialog / return object Data
		getOdata: function(oDialog){
			var oData = {};
			var inputs = oDialog.getAggregation("content");
			for(var i = 0; i < inputs.length; i++){
				var input = inputs[i];
				if(input["sId"].indexOf('hbox') > -1){
					var vboxes = input.getItems();
					for(var j = 0; j < vboxes.length; j++){
						oData = this.mergeObjects(oData, this.getDataInner(vboxes[j]));
					}
				}else{
					oData = this.mergeObjects(oData, this.getDataInner(input));
				}
			}
			oData.Code = this.code;
			return oData;
		},
		
		// Inner function for getOdata in case hbox is presented 
		getDataInner: function(input){
			var oData = {};
			if(input.data("value") !== null){
				oData[input.getBindingInfo("value").binding.sPath] = input.data("value");
			}else if(input.hasOwnProperty("_oMaxDate")){
				var date = input.getDateValue();
				if(date) {
					date.setMinutes(-date.getTimezoneOffset());
				} else { 
					date = null;
				}
				oData[input.getBindingInfo("dateValue").binding.sPath] = date;
			}else if(input .getBindingInfo("value")){
				oData[input .getBindingInfo("value").binding.sPath] = input.getValue();
			}else if(input.getBindingInfo("selectedKey")){
				oData[input.getBindingInfo("selectedKey").binding.sPath] = input.getSelectedKey();
			}else if(input.getBindingInfo("selected")){
				oData[input.getBindingInfo("selected").binding.sPath] = input.getSelected();
			}
			return oData;
		},
		
		// Object.assign doesnt work in IE so this function is created
		mergeObjects: function(objOne, objTwo){
			var objs = [objOne, objTwo],
		    result =  objs.reduce(function (r, o) {
		        Object.keys(o).forEach(function (k) {
		            r[k] = o[k];
		        });
		        return r;
		    }, {});
		    return result;
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
				var input = this.byId(idArr[i]) || sap.ui.getCore().byId(idArr[i]);
				if(input){
					input.setEnabled(flag);
				}
			}
		},
		
		// Edit element function
		elementEdit: function(oEvent){
			var id = oEvent.getSource().data("id");
			var dialog = this[id + "Dialog"];
			var oElement = this.byId(id + "Element");
			if(oElement.getElementBinding()){
				var url = oElement.getElementBinding().getPath();
				dialog.unbindElement();
				dialog.bindElement(url);
			}
			dialog.open();
		},
		
		//============================= UPLOAD Functions =============================
		// Set file DocType by changing uploadUrl
		onTypeSelect: function(oEvent){
			var select = oEvent.getSource();
			var selectedKey = select.getSelectedItem().getKey();
			var id = select.data("id");
			var uploader = this.byId(id) || sap.ui.getCore().byId(id);
			var url = this.getModel().sServiceUrl + "/AttachHelperSet(PartnerCode='" + this.code + "',DocType='" + selectedKey + "')/ToAttachments";
			uploader.setUploadUrl(url);
		},
		
		// Triggered each time the new file was selected in fileUploader
		// Changes the fileName (slug)
		onFileChange: function(oEvent){
			var uploader = oEvent.getSource();
			var name = oEvent.getParameter("newValue");
			var model = uploader.getModel("upload");
			var data = model.getData();
			data.fileName = encodeURI(name);
			model.setData(data);
		},
		
		// After file uploaded, closes dialog and refreshes the table
		onFileUploaded: function(oEvent){
			if(oEvent.getParameter("status") === 400){
				MessageBox.alert(this.getResourceBundle().getText("alreadyUploaded"), {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			}else{
				var id = oEvent.getSource().data("id");
				var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
				var url = table.mBindingInfos.items.path;
				var filters = table.mBindingInfos.items.filters;
				this.bindTable(id + "Table", url, filters);
				this.clearValues(this[id + "Dialog"]);
				this[id + "Dialog"].close();
			}
		},
		
		// Simple upload function
		dialogUpload: function(oEvent){
			var id = oEvent.getSource().data("id");
			var uploader = this.byId(id) || sap.ui.getCore().byId(id);
			var select = this.byId(id + "Select") || sap.ui.getCore().byId(id + "Select");
			if(select.getSelectedKey() && uploader.getValue()){
				uploader.upload();
			}else{
				MessageBox.alert("Please, select Type and File!", {
					actions: [sap.m.MessageBox.Action.CLOSE]
				});
			}
		},
		
		// Download function
		tableDownload: function(oEvent){
			var id = oEvent.getSource().data("id");
			var table = this.byId(id + "Table") || sap.ui.getCore().byId(id + "Table");
			var url = table.getModel().sServiceUrl + table.getSelectedItem().getBindingContextPath() + "/$value";
			window.open(url);
		},
		
		// Proxy table row button download
		downloadAttachmentButton: function(oEvent){
			var button = oEvent.getSource();
			var serviceUrl = button.getModel().sServiceUrl;
			var url = button.getBindingContext().getPath();
			var fullUrl = serviceUrl + url + "/$value";
			window.open(fullUrl);
		},
		
		deleteAttachmentButton: function(oEvent){
			var button = oEvent.getSource();
			var model = button.getModel();
			var url = button.getBindingContext().getPath() + "/$value";
			
			MessageBox.confirm("Are you sure you want to delete?", {
				actions: ["Delete", sap.m.MessageBox.Action.CLOSE],
				onClose: function(sAction) {
					if (sAction === "Delete") {
						model.remove(url);
					} else {
						MessageToast.show("Delete canceled!");
					}
				}
			});
		},
		
		onCheck: function(oEvent){
			var check = oEvent.getSource();
			if(check.getSelected()){
				sap.ui.getCore().byId("ratingBusinessScale").setSelectedKey("").setEnabled(false);
				sap.ui.getCore().byId("ratingCorporateTransparency").setSelectedKey("").setEnabled(false);
			}else{
				this.setEnabled(["ratingBusinessScale", "ratingCorporateTransparency"], true);
			}
		},

	    // Checking input values for compliance with business-logic.
	    // For numeric values only.
		checkDecimal: function(oEvent){
			var input = oEvent.getSource();
			var decimal = input.data("decimal") || 2;
			var max = input.data("max") || 3;
			var value = oEvent.getParameter("value");
			var oLocale = new sap.ui.core.Locale("en-US");
			var oFormatOptions = {
			    minIntegerDigits: 0,
			    maxIntegerDigits: max,
			    minFractionDigits: 0,
			    maxFractionDigits: decimal
			};
			var checkValue  = sap.ui.core.format.NumberFormat.getFloatInstance(oFormatOptions, oLocale);
			var newValue = checkValue.format(value);
			// alert( value + " --- " + value.indexOf(".") + " --- " + value.length + " --- " + (value.length - value.indexOf(".")));
			if( (newValue.indexOf("?") != -1) ||
			    ( (value.length - value.indexOf(".")) >= 4 )  ){
			   MessageBox.error("Value '"+ value +"' is invalid.\n" + "The value can be three digits to the decimal point and two after the decimal point.\n" + "Examples:  95.51,  150.1,  2,  999.05,  0.2;");
			   oEvent.getSource().setValue( "0" );
			 }else{
			   oEvent.getSource().setValue( newValue );
			 }
		}

	});
});