import React from "react";
import {IconButton} from "elv-components-js";
import MenuIcon from "../static/icons/Menu.svg";
import {inject, observer} from "mobx-react";
import KeyboardControls from "./controls/KeyboardControls";
import Save from "./controls/Save";

@inject("menu")
@inject("video")
@observer
class Header extends React.Component {
  render() {
    return (
      <header>
        <div className="header-left">
          <IconButton
            icon={MenuIcon}
            title="Menu"
            onClick={this.props.menu.ToggleMenu}
            className={`menu-button ${this.props.menu.showMenu ? "menu-button-active" : ""}`}
          />
          <h1 className="header-text">
            { this.props.video.name || "Eluvio Video Editor" }
          </h1>
        </div>
        <div className="header-right">
          <Save />
          <KeyboardControls />
        </div>
      </header>
    );
  }
}

export default Header;
