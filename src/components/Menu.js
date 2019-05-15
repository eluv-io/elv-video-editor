import React from "react";
import {inject, observer} from "mobx-react";
import AsyncComponent from "./AsyncComponent";
import {IconButton, onEnterPressed} from "elv-components-js";

import BackIcon from "../static/icons/DoubleBackward.svg";

@inject("menu")
@inject("video")
@observer
class Menu extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      library: undefined,
      object: undefined
    };

    this.SelectLibrary = this.SelectLibrary.bind(this);
    this.SelectObject = this.SelectObject.bind(this);
  }

  async SelectLibrary(library) {
    this.setState({library});
  }

  async SelectObject(libraryId, objectId) {
    this.props.video.Reset();
    await this.props.video.SelectObject(libraryId, objectId);

    this.setState({
      library: undefined,
      object: undefined
    }, () => this.props.menu.ToggleMenu());
  }

  Objects(libraryId) {
    return (
      <AsyncComponent key="objects-container" Load={async () => await this.props.menu.ListObjects(libraryId)}>
        {
          <ul>
            {
              (this.props.menu.objects[libraryId] || []).map(object => {
                const onClick = () => this.setState({object});
                return (
                  <li
                    tabIndex={1}
                    onClick={onClick}
                    onKeyPress={onEnterPressed(onClick)}
                    key={`content-object-${object.objectId}`}
                  >
                    {object.meta.name}
                  </li>
                );
              })
            }
          </ul>
        }
      </AsyncComponent>
    );
  }

  Libraries() {
    return (
      <AsyncComponent key="libraries-container" Load={this.props.menu.ListLibraries}>
        {
          <ul>
            {
              this.props.menu.libraries.map(library => {
                const onClick = () => this.SelectLibrary(library);

                return (
                  <li
                    tabIndex={1}
                    onKeyPress={onEnterPressed(onClick)}
                    onClick={onClick}
                    key={`library-${library.libraryId}`}
                  >
                    {library.meta.name}
                  </li>
                );
              })
            }
          </ul>
        }
      </AsyncComponent>
    );
  }

  Navigation() {
    if(this.state.object) {
      return (
        <AsyncComponent Load={() => this.SelectObject(this.state.library.libraryId, this.state.object.objectId)} />
      );
    } if(this.state.library) {
      return this.Objects(this.state.library.libraryId);
    } else {
      return this.Libraries();
    }
  }

  render() {
    if(!this.props.menu.showMenu) { return null; }

    const backButton = this.state.library ?
      <IconButton icon={BackIcon} onClick={() => this.setState({library: undefined})}>Menu</IconButton> : null;

    return (
      <div className="menu-container">
        { backButton }
        { this.Navigation() }
      </div>
    );
  }
}

export default Menu;
