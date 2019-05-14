import React from "react";
import {IconButton} from "elv-components-js";
import MenuIcon from "../static/icons/Menu.svg";
import {inject, observer} from "mobx-react";

@inject("menu")
@inject("video")
@observer
class Header extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <header>
        <IconButton
          icon={MenuIcon}
          title="Menu"
          onClick={this.props.menu.ToggleMenu}
          className={`menu-button ${this.props.menu.showMenu ? "menu-button-active" : ""}`}
        />
        <h1 className="header-text">
          { this.props.video.name }
        </h1>
      </header>
    );
  }
}

export default Header;
