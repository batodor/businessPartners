function onChange(oEvent) {
	var oUploadCollection = oEvent.getSource();
	// Header Token
	var oCustomerHeaderToken = new UploadCollectionParameter({
		name: "x-csrf-token",
		value: "securityTokenFromModel"
	});
	oUploadCollection.addHeaderParameter(oCustomerHeaderToken);
}

function onFileSizeExceed() {
	MessageToast.show("FileSize Exceed");
}

function onTypeMissmatch() {
	MessageToast.show("Type Missmatch");
}

function onUploadComplete(oEvent) {
	var id = oEvent.getSource().data('id');
	// If the upload is triggered by a new version, this function updates the metadata of the old file and deletes the progress indicator once the upload was finished.
	if (this.bIsUploadVersion) {
		this.updateFile(id);
	} else {
		var oUploadCollection = this.byId(id + "Table");
		var oData = oUploadCollection.getModel().getData();
		var aItems = jQuery.extend(true, {}, oData).items;
		var oItem = {};
		var sUploadedFile = oEvent.getParameter("files")[0].fileName;
		// at the moment parameter fileName is not set in IE9
		if (!sUploadedFile) {
			var aUploadedFile = (oEvent.getParameters().getSource().getProperty("value")).split(/\" "/);
			sUploadedFile = aUploadedFile[0];
		}
		oItem = {
			"documentId": jQuery.now().toString(), // generate Id,
			"fileName": sUploadedFile,
			"mimeType": "",
			"thumbnailUrl": "",
			"url": "",
			"attributes": [
				{
					"title": "Uploaded By",
					"text": "You"
				},
				{
					"title": "Uploaded On",
					"text": new Date(jQuery.now()).toLocaleDateString()
				},
				{
					"title": "File Size",
					"text": "505000"
				},
				{
					"title": "Version",
					"text": "1"
				}
			]
		};
		aItems.unshift(oItem);
		oUploadCollection.getModel().setData({
			"items": aItems
		});
		// Sets the text to the label
		this.byId(id + "Title").setText(this.getAttachmentTitleText(id));
	}

	// delay the success message for to notice onChange message
	setTimeout(function() {
		MessageToast.show("Upload Complete");
	}, 4000);
}

function onBeforeUploadStarts(oEvent) {
	var oCustomerHeaderSlug = new UploadCollectionParameter({
		name: "slug",
		value: oEvent.getParameter("fileName")
	});
	oEvent.getParameters().addHeaderParameter(oCustomerHeaderSlug);
	MessageToast.show("Before Upload Starts");
}

function getAttachmentTitleText(id) {
	var aItems = this.byId(id + "Table").getItems();
	return "Uploaded (" + aItems.length + ")";
}

function onDownloadItem(oEvent) {
	var oUploadCollection = this.byId(oEvent.getSource().data('id') + "Table");
	var selectedItem = oUploadCollection.getSelectedItem();
	if (selectedItem) {
		var path = selectedItem.getBindingContext().getPath();
		var url = selectedItem.getModel().getData(path).__metadata.media_src;
		// var model = selectedItem.getModel();
		// var id = selectedItem.getProperty("documentId");
		// var url = "https://ws-ere.corp.suek.ru" + model.sServiceUrl + "/AttachmentSet('" + id + "')/$value";
		window.open(url,"_self");
	} else {
		MessageToast.show("Select an item to download");
	}
}

function onUpdateItem(oEvent) {
	var oUploadCollection = this.byId(oEvent.getSource().data('id') + "Table");
	this.bIsUploadVersion = true;
	this.oItemToUpdate = oUploadCollection.getSelectedItem();
	oUploadCollection.openFileDialog(this.oItemToUpdate);
}

function onSelectionChange(oEvent) {
	var id = oEvent.getSource().data('id');
	var oUploadCollection = this.byId(id + "Table");
	if (oUploadCollection.getSelectedItems().length > 0) {
		this.setEnabled([id + "Download", id + "Update"], true);
	} else {
		this.setEnabled([id + "Download", id + "Update"], false);
	}
}

function updateFile(id) {
	var oData = this.byId(id + "Table").getModel().getData();
	var aItems = jQuery.extend(true, {}, oData).items;
	// Adds the new metadata to the file which was updated.
	for (var i = 0; i < aItems.length; i++) {
		if (aItems[i].documentId === this.oItemToUpdate.getDocumentId()) {
			// Uploaded by
			aItems[i].attributes[0].text = "You";
			// Uploaded on
			aItems[i].attributes[1].text = new Date(jQuery.now()).toLocaleDateString();
			// Version
			var iVersion = parseInt(aItems[i].attributes[3].text, 10);
			iVersion++;
			aItems[i].attributes[3].text = iVersion;
		}
	}
	// Updates the model.
	this.byId(id + "Table").getModel().setData({
		"items": aItems
	});
	// Sets the flag back to false.
	this.bIsUploadVersion = false;
	this.oItemToUpdate = null;
}