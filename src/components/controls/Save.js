import React from "react";
import {observer, inject} from "mobx-react";
import {IconButton, ToolTip} from "elv-components-js";
import SaveIcon from "../../static/icons/Save.svg";
import LoadingElement from "elv-components-js/src/components/LoadingElement";
import SaveModal from "./SaveModal";

@inject("editStore")
@inject("videoStore")
@observer
class Save extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      showModal: false
    };
  }

  render() {
    return (
      <LoadingElement loading={this.props.editStore.saving} loadingClassname="header-icon save-icon-loading">
        <ToolTip content={<span>Save</span>}>
          <IconButton
            onClick={() => this.setState({showModal: true})}
            icon={SaveIcon}
            className={`header-icon save-icon ${this.props.editStore.saveFailed ? "save-failed" : ""}`}
          />
        </ToolTip>
        <SaveModal
          show={this.state.showModal}
          HandleSubmit={(trimOfferings) => {
            this.props.editStore.Save({trimOfferings});
          }}
          HandleClose={() => this.setState({showModal: false})}
        />
      </LoadingElement>
    );
  }
}

export default Save;
