import React from "react";
import {observer, inject} from "mobx-react";
import {BrowseWidget, Form, IconButton, Modal, Tabs, ToolTip} from "elv-components-js";
import UploadIcon from "../../static/icons/Upload.svg";

@inject("video")
@observer
class UploadModal extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      metadataRemote: false,
      overlayRemote: false,

      metadataFile: undefined,
      metadataFileRemote: undefined,
      overlayFiles: [],
      overlayFilesRemote: []
    };
  }

  MetadataTags() {
    let browse;

    if(this.state.metadataRemote) {
      browse = (
        <BrowseWidget
          key="metadata-browse-remote"
          remote={true}
          header="Select Metadata Tag File"
          fileMetadata={this.props.video.metadata.files || {}}
          mimeTypes={this.props.video.metadata.mime_types || {}}
          baseFileUrl={this.props.video.baseFileUrl}
          extensions={["json"]}
          multiple={false}
          onChange={filePaths => this.setState({metadataFileRemote: filePaths[0]})}
        />
      );
    } else {
      browse = (
        <BrowseWidget
          key="metadata-browse-local"
          name="Metadata Tags File"
          multiple={false}
          directories={false}
          required={false}
          accept={["application/json"]}
          onChange={event => this.setState({metadataFile: event.target.files[0]})}
        />
      );
    }

    return (
      <div className="upload-section">
        <h3>Metadata Tags</h3>
        <div className="labelled-field">
          <label>Source</label>
          <Tabs
            onChange={() => this.setState({
              metadataRemote: !this.state.metadataRemote,
              metadataFile: undefined,
              metadataFileRemote: undefined
            })}
            selected={this.state.metadataRemote}
            options={[["Local", false], ["Remote", true]]}
            className="secondary"
          />
        </div>
        <div className="labelled-field">
          <label>File</label>
          { browse }
        </div>
      </div>
    );
  }

  OverlayTags() {
    let browse;

    if(this.state.overlayRemote) {
      browse = (
        <BrowseWidget
          key="overlay-browse-remote"
          remote={true}
          header="Select Overlay Tags File(s)"
          fileMetadata={this.props.video.metadata.files || {}}
          mimeTypes={this.props.video.metadata.mime_types || {}}
          baseFileUrl={this.props.video.baseFileUrl}
          extensions={["json"]}
          multiple={true}
          onChange={filePaths => this.setState({overlayFilesRemote: filePaths})}
        />
      );
    } else {
      browse = (
        <BrowseWidget
          key="overlay-browse-local"
          name="Overlay Tags File(s)"
          multiple
          directories={false}
          required={false}
          accept={["application/json"]}
          onChange={event => this.setState({overlayFiles: event.target.files})}
        />
      );
    }

    return (
      <div className="upload-section">
        <h3>Overlay Tags</h3>
        <div className="labelled-field">
          <label>Source</label>
          <Tabs
            onChange={() => this.setState({
              overlayRemote: !this.state.overlayRemote,
              overlayFiles: [],
              overlayFilesRemote: []
            })}
            selected={this.state.overlayRemote}
            options={[["Local", false], ["Remote", true]]}
            className="secondary"
          />
        </div>
        <div className="labelled-field">
          <label>Files</label>
          { browse }
        </div>
      </div>
    );
  }

  render() {
    return (
      <Form
        legend="Upload Metadata Tags"
        OnSubmit={() => this.props.onSubmit({
          metadataFile: this.state.metadataFile,
          overlayFiles: this.state.overlayFiles,
          metadataFileRemote: this.state.metadataFileRemote,
          overlayFilesRemote: this.state.overlayFilesRemote
        })}
        OnCancel={this.props.onCancel}
      >
        { this.MetadataTags() }
        { this.OverlayTags() }
      </Form>
    );
  }
}

@inject("edit")
@observer
class Upload extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      modal: null,
      uploading: false
    };

    this.Upload = this.Upload.bind(this);
    this.CloseModal = this.CloseModal.bind(this);
    this.ActivateModal = this.ActivateModal.bind(this);
  }

  async Upload({metadataFile, metadataFileRemote, overlayFiles, overlayFilesRemote}) {
    this.setState({uploading: true});

    try {
      await this.props.edit.UploadMetadataTags({
        metadataFile,
        metadataFileRemote,
        overlayFiles,
        overlayFilesRemote
      });
      this.CloseModal();
    } catch(error) {
      this.setState({uploading: false});
      throw error;
    }

    this.setState({uploading: false});
  }

  ActivateModal() {
    this.setState({
      modal: (
        <Modal className="upload-modal">
          <UploadModal
            onSubmit={this.Upload}
            onCancel={this.CloseModal}
          />
        </Modal>
      )
    });
  }

  CloseModal() {
    this.setState({modal: null});
  }

  render() {
    return (
      <React.Fragment>
        <ToolTip content={<span>Upload tags</span>}>
          <IconButton
            onClick={this.ActivateModal}
            icon={UploadIcon}
            className={`header-icon upload-icon ${this.props.edit.uploadFailed ? "upload-failed" : ""}`}
          />
        </ToolTip>
        { this.state.modal }
      </React.Fragment>
    );
  }
}

export default Upload;
