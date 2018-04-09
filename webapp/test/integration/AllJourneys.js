/*global QUnit*/

jQuery.sap.require("sap.ui.qunit.qunit-css");
jQuery.sap.require("sap.ui.thirdparty.qunit");
jQuery.sap.require("sap.ui.qunit.qunit-junit");
QUnit.config.autostart = false;

sap.ui.require([
	"sap/ui/test/Opa5",
	"counterparties/Counterparties/test/integration/pages/Common",
	"sap/ui/test/opaQunit",
	"counterparties/Counterparties/test/integration/pages/Worklist",
	"counterparties/Counterparties/test/integration/pages/Object",
	"counterparties/Counterparties/test/integration/pages/NotFound",
	"counterparties/Counterparties/test/integration/pages/Browser",
	"counterparties/Counterparties/test/integration/pages/App"
], function (Opa5, Common) {
	"use strict";
	Opa5.extendConfig({
		arrangements: new Common(),
		viewNamespace: "counterparties.Counterparties.view."
	});

	sap.ui.require([
		"counterparties/Counterparties/test/integration/WorklistJourney",
		"counterparties/Counterparties/test/integration/ObjectJourney",
		"counterparties/Counterparties/test/integration/NavigationJourney",
		"counterparties/Counterparties/test/integration/NotFoundJourney",
		"counterparties/Counterparties/test/integration/FLPIntegrationJourney"
	], function () {
		QUnit.start();
	});
});