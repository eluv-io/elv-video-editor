import React from "react";
import {observer, inject} from "mobx-react";
import {BrowseWidget, Form, IconButton, Modal, ToolTip} from "elv-components-js";
import UploadIcon from "../../static/icons/Upload.svg";

class UploadModal extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      metadataFile: undefined,
      overlayFiles: []
    };
  }

  render() {
    return (
      <Form
        legend="Upload Metadata Tags"
        OnSubmit={() => this.props.onSubmit({
          metadataFile: this.state.metadataFile,
          overlayFiles: this.state.overlayFiles
        })}
        OnCancel={this.props.onCancel}
      >
        <div className="labelled-field">
          <label>Metadata Tags</label>
          <BrowseWidget
            name="Metadata File"
            multiple={false}
            directories={false}
            required={false}
            accept={["application/json"]}
            onChange={event => this.setState({metadataFile: event.target.files[0]})}
          />
        </div>
        <div className="labelled-field">
          <label>Overlay Tags</label>
          <BrowseWidget
            name="Metadata File"
            multiple
            directories={false}
            required={false}
            accept={["application/json"]}
            onChange={event => this.setState({overlayFiles: event.target.files})}
          />
        </div>
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

  async Upload({metadataFile, overlayFiles}) {
    this.setState({uploading: true});

    try {
      await this.props.edit.UploadMetadataTags({metadataFile, overlayFiles});
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
        <ToolTip content={<span>Upload metadata tags</span>}>
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
