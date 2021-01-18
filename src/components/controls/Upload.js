import React from "react";
import {observer, inject} from "mobx-react";
import {BrowseWidget, Form, IconButton, Modal, Tabs, ToolTip} from "elv-components-js";
import UploadIcon from "../../static/icons/Upload.svg";

@inject("videoStore")
@observer
class UploadModal extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      metadataRemote: false,
      overlayRemote: false,
      metadataFiles: [],
      metadataFilesRemote: [],
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
          header="Select Metadata Tag Files"
          fileMetadata={this.props.videoStore.metadata.files || {}}
          mimeTypes={this.props.videoStore.metadata.mime_types || {}}
          baseFileUrl={this.props.videoStore.baseFileUrl}
          extensions={["json"]}
          multiple={true}
          onChange={filePaths => this.setState({metadataFilesRemote: filePaths})}
        />
      );
    } else {
      browse = (
        <BrowseWidget
          key="metadata-browse-local"
          name="Metadata Tags File"
          multiple={true}
          directories={false}
          required={false}
          accept={["application/json"]}
          onChange={event => this.setState({metadataFiles: event.target.files})}
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
              metadataFiles: [],
              metadataFilesRemote: []
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
          fileMetadata={this.props.videoStore.metadata.files || {}}
          mimeTypes={this.props.videoStore.metadata.mime_types || {}}
          baseFileUrl={this.props.videoStore.baseFileUrl}
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
          metadataFiles: this.state.metadataFiles,
          overlayFiles: this.state.overlayFiles,
          metadataFilesRemote: this.state.metadataFilesRemote,
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

@inject("editStore")
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

  async Upload({metadataFiles, metadataFilesRemote, overlayFiles, overlayFilesRemote}) {
    this.setState({uploading: true});

    try {
      await this.props.editStore.UploadMetadataTags({
        metadataFiles,
        metadataFilesRemote,
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
            className={`header-icon upload-icon ${this.props.editStore.uploadFailed ? "upload-failed" : ""}`}
          />
        </ToolTip>
        { this.state.modal }
      </React.Fragment>
    );
  }
}

export default Upload;
