sap.ui.define([
	"counterparties/Counterparties/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"counterparties/Counterparties/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(BaseController, JSONModel, History, formatter, Filter, FilterOperator) {
	"use strict";

	return BaseController.extend("counterparties.Counterparties.controller.Worklist", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function() {
			var oViewModel,
				iOriginalBusyDelay,
				oTable = this.byId("table");

			// Put down worklist table's original value for busy indicator delay,
			// so it can be restored later on. Busy handling on the table is
			// taken care of by the table itself.
			iOriginalBusyDelay = oTable.getBusyIndicatorDelay();
			// keeps the search state
			this._aTableSearchState = [];

			// Model used to manipulate control states
			oViewModel = new JSONModel({
				worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
				saveAsTileTitle: this.getResourceBundle().getText("worklistViewTitle"),
				shareOnJamTitle: this.getResourceBundle().getText("worklistViewTitle"),
				shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
				shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
				tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
				tableBusyDelay: 0
			});
			this.setModel(oViewModel, "worklistView");

			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oTable.attachEventOnce("updateFinished", function() {
				// Restore original busy indicator delay for worklist's table
				oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
			});
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Triggered by the table's 'updateFinished' event: after new table
		 * data is available, this handler method updates the table counter.
		 * This should only happen if the update was successful, which is
		 * why this handler is attached to 'updateFinished' and not to the
		 * table's list binding's 'dataReceived' method.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function(oEvent) {
			// update the worklist's object counter after the table update
			var sTitle,
				oTable = oEvent.getSource(),
				iTotalItems = oEvent.getParameter("total");
			// only update the counter if the length is final and
			// the table is not empty
			if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
			} else {
				sTitle = this.getResourceBundle().getText("worklistTableTitle");
			}
			this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
		},

		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPress: function(oEvent) {
			// The source is the list item that got pressed
			this._showObject(oEvent.getSource());
		},

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function() {
			var oViewModel = this.getModel("worklistView"),
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

		triggerSearch: function() {
			this.onSearch();
		},

		onSearch: function() {
			var query = [];
			var code = this.byId('searchCode').getValue();
			var country = this.byId('searchCountry').getValue();
			var name = this.byId('searchName').getValue();
			var legalForm = this.byId('searchLegalForm').getValue();
			var legalName = this.byId('searchLegalName').getValue();
			var engName = this.byId('searchEnglishName').getValue();
			var taxNumber = this.byId('searchTaxNumber').getValue();
			var dateFrom = this.byId('searchDateFrom').getValue();
			var dateTo = this.byId('searchDateTo').getValue();
			var blacklist = this.byId('cbSearchBlacklisted').getSelected();
			
			if (code !== "") {
				var codeFilter = new Filter("Code", FilterOperator.EQ, code);
				query.push(codeFilter);
			}
			if (country !== "") {
				var countryFilter = new Filter("Country", FilterOperator.EQ, country);
				query.push(countryFilter);
			}
			if (name !== "") {
				var nameFilter = new Filter("Name", FilterOperator.EQ, name);
				query.push(nameFilter);
			}
			if (legalForm !== "") {
				var legalFormFilter = new Filter("LegalForm", FilterOperator.EQ, legalForm);
				query.push(legalFormFilter);
			}
			if (legalName !== "") {
				var legalNameFilter = new Filter("LegalName", FilterOperator.EQ, legalName);
				query.push(legalNameFilter);
			}
			if (engName !== "") {
				var engNameFilter = new Filter("EngName", FilterOperator.EQ, engName);
				query.push(engNameFilter);
			}
			if (taxNumber !== "") {
				var taxNumberFilter = new Filter("TaxNumber", FilterOperator.EQ, taxNumber);
				query.push(taxNumberFilter);
			}
			if (dateFrom !== "" && dateTo !== "") {
				var dateFilter = new Filter("DateCreation", FilterOperator.BT, dateFrom, dateTo);
				query.push(dateFilter);
			} else {
				if (dateFrom !== "") {
					var dateFromFilter = new Filter("DateCreation", FilterOperator.GT, dateFrom);
					query.push(dateFromFilter);
				}
				if (dateTo !== "") {
					var dateToFilter = new Filter("DateCreation", FilterOperator.LT, dateTo);
					query.push(dateToFilter);
				}
			}
			if(blacklist){
				var blacklistFilter = new Filter("Blacklisted", FilterOperator.EQ, blacklist);
				query.push(blacklistFilter);
			}
			this._applySearch(query);
		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function() {
			var oTable = this.byId("table");
			oTable.getBinding("items").refresh();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Shows the selected item on the object page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showObject: function(oItem) {
			this.getRouter().navTo("object", {
				objectId: oItem.getBindingContext().getProperty("Code")
			});
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @param {sap.ui.model.Filter[]} aTableSearchState An array of filters for the search
		 * @private
		 */
		_applySearch: function(aTableSearchState) {
			var oTable = this.byId("table"),
				oViewModel = this.getModel("worklistView");
			oTable.getBinding("items").filter(aTableSearchState, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aTableSearchState.length !== 0) {
				oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
			}
		},

		onSuggestCountry: function(event) {
			var value = event.getParameter("suggestValue");
			var filters = [];
			if (value) {
				var country = new sap.ui.model.Filter("Name", FilterOperator.EQ, value);
				var countryKey = new sap.ui.model.Filter("Key", FilterOperator.EQ, value);
				filters.push(country, countryKey);
				var oSource = event.getSource();
				var oBinding = oSource.getBinding('suggestionItems');
				oBinding.filter(filters);
				oBinding.attachEvent('dataReceived', function() {
					// now activate suggestion popup
					oSource.suggest();
				});
			}
		},

		onSuggestCode: function(event) {
			var value = event.getParameter("suggestValue");
			var filters = [];
			if (value && value.length > 2) {
				filters.push(new sap.ui.model.Filter({
					filters: [
						new sap.ui.model.Filter("Code", sap.ui.model.FilterOperator.Contains, value)
					]
				}));
				event.getSource().getBinding("suggestionItems").filter(filters);
				event.getSource().suggest();
			}
		}
	});
});