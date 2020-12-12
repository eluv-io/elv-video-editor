import React from "react";
import {observer, inject} from "mobx-react";
import {IconButton, ToolTip} from "elv-components-js";
import SaveIcon from "../../static/icons/Save.svg";
import LoadingElement from "elv-components-js/src/components/LoadingElement";

@inject("editStore")
@observer
class Save extends React.Component {
  render() {
    return (
      <LoadingElement loading={this.props.editStore.saving} loadingClassname="header-icon save-icon-loading">
        <ToolTip content={<span>Save</span>}>
          <IconButton
            onClick={this.props.editStore.Save}
            icon={SaveIcon}
            className={`header-icon save-icon ${this.props.editStore.saveFailed ? "save-failed" : ""}`}
          />
        </ToolTip>
      </LoadingElement>
    );
  }
}

export default Save;
