import React from "react";
import {observer, inject} from "mobx-react";
import {IconButton} from "elv-components-js";
import SaveIcon from "../../static/icons/Save.svg";
import LoadingElement from "elv-components-js/src/components/LoadingElement";

@inject("edit")
@observer
class Save extends React.Component {
  render() {
    return (
      <LoadingElement loading={this.props.edit.saving} loadingClassname="header-icon save-icon-loading">
        <IconButton
          onClick={this.props.edit.Save}
          icon={SaveIcon}
          className={`header-icon save-icon ${this.props.edit.saveFailed ? "save-failed" : ""}`}
        />
      </LoadingElement>
    );
  }
}

export default Save;
