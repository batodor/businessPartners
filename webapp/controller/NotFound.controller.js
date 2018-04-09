sap.ui.define([
		"counterparties/Counterparties/controller/BaseController"
	], function (BaseController) {
		"use strict";

		return BaseController.extend("counterparties.Counterparties.controller.NotFound", {

			/**
			 * Navigates to the worklist when the link is pressed
			 * @public
			 */
			onLinkPressed : function () {
				this.getRouter().navTo("worklist");
			}

		});

	}
);