import React from "react";
import {IconButton, ToolTip} from "elv-components-js";
import MenuIcon from "../static/icons/Menu.svg";
import {inject, observer} from "mobx-react";
import KeyboardControls from "./controls/KeyboardControls";
import Save from "./controls/Save";
import Upload from "./controls/Upload";

import TagIcon from "../static/icons/tag.svg";
import AssetsIcon from "../static/icons/file.svg";

@inject("rootStore")
@inject("menuStore")
@inject("videoStore")
@observer
class Header extends React.Component {
  /*
      <ToolTip content="Clip">
        <IconButton
          className={this.props.rootStore.view === "clip" ? "active" : ""}
          icon={ClipIcon}
          onClick={() => this.props.rootStore.SetView("clip")}
        />
      </ToolTip>
   */

  OfferingSection = () => {
    if(!this.props.rootStore.offerings || Object.keys(this.props.rootStore.offerings).length === 0) { return null; }

    return (
      <div className="offering-section">
        <label htmlFor="offering" className="offering-label">Offering</label>
        <select
          id="offering"
          className="offering-dropdown"
          onChange={(event) => {
            this.props.rootStore.SetOffering(event.target.value);
            this.props.videoStore.SetVideo(this.props.menuStore.selectedObject);
          }}
        >
          {
            Object.keys(this.props.rootStore.offerings || {}).map(offeringName => (
              <option
                value={offeringName}
                key={`offering-${offeringName}`}
                disabled={!this.props.rootStore.offerings[offeringName].isHlsClear}
              >{offeringName}</option>
            ))
          }
        </select>
      </div>
    );
  }

  render() {
    return (
      <header>
        <div className="header-left">
          <IconButton
            icon={MenuIcon}
            title="Menu"
            onClick={() => this.props.menuStore.ToggleMenu(!this.props.menuStore.showMenu)}
            className={`menu-button ${this.props.menuStore.showMenu ? "menu-button-active" : ""}`}
          />
          <h1 className="header-text">
            { this.props.videoStore.name || "Eluvio Video Editor" }
          </h1>
        </div>
        <div className="header-center mode-selection">
          <ToolTip content="Tag">
            <IconButton
              className={this.props.rootStore.view === "main" ? "active" : ""}
              icon={TagIcon}
              onClick={() => this.props.rootStore.SetView("main")}
            />
          </ToolTip>
          <ToolTip content="Assets">
            <IconButton
              className={this.props.rootStore.view === "assets" ? "active" : ""}
              icon={AssetsIcon}
              onClick={() => this.props.rootStore.SetView("assets")}
            />
          </ToolTip>
        </div>
        <div className="header-right">
          { this.OfferingSection() }
          <Upload />
          <Save />
          <KeyboardControls />
        </div>
      </header>
    );
  }
}

export default Header;
