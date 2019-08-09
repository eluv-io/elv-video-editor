import React from "react";
import {inject, observer} from "mobx-react";
import {AsyncComponent, IconButton, onEnterPressed} from "elv-components-js";

import BackIcon from "../static/icons/DoubleBackward.svg";
import LoadingElement from "elv-components-js/src/components/LoadingElement";

@inject("menu")
@observer
class Menu extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      library: undefined,
      objectId: undefined
    };

    this.SelectLibrary = this.SelectLibrary.bind(this);
    this.SelectObject = this.SelectObject.bind(this);
  }

  componentDidMount() {
    this.SelectObject(
      "",
      "",
      "hq__KPspqctp8ovEmGKangsBGq54ff8PcHTzkYrEyqPJZWXqqCkHz8DXXDvQ7jxZYP1tu3ZH5NkLDc"
    );
  }

  async SelectLibrary(library) {
    this.setState({library});
  }

  async SelectObject(libraryId, objectId, versionHash) {
    this.props.menu.ToggleMenu();
    this.setState({objectId});

    await this.props.menu.SelectVideo({libraryId, objectId, versionHash});
  }

  SelectedObject() {
    const object = this.props.menu.selectedObject;

    return (
      <LoadingElement
        loading={!object}
        render={() => (
          <div className="menu-entries">
            <div className="menu-header">
              <IconButton className="menu-back" icon={BackIcon} onClick={() => this.setState({objectId: undefined})}>
                Menu
              </IconButton>
              <h4>{object.name}</h4>
            </div>

            <h5>{object.metadata.description}</h5>

            <div className="video-info">
              <label>Library ID</label>
              <div>{object.libraryId}</div>

              <label>Object ID</label>
              <span>{object.objectId}</span>

              <label>Version Hash</label>
              <span className="wrap">{object.versionHash}</span>
            </div>
          </div>
        )}
      />
    );
  }

  Objects() {
    const libraryId = this.state.library.libraryId;

    const objects = (
      <AsyncComponent
        key="objects-container"
        Load={async () => await this.props.menu.ListObjects(libraryId)}
      >
        {
          (this.props.menu.objects[libraryId] || []).length === 0 ?
            <div className="menu-empty">No Content Available</div> :
            <ul>
              {
                (this.props.menu.objects[libraryId] || []).map(object => {
                  const onClick = () => this.SelectObject(libraryId, object.objectId, object.versionHash);

                  return (
                    <li
                      tabIndex={0}
                      onClick={onClick}
                      onKeyPress={onEnterPressed(onClick)}
                      key={`content-object-${object.objectId}`}
                    >
                      {object.metadata.name}
                    </li>
                  );
                })
              }
            </ul>
        }
      </AsyncComponent>
    );

    return (
      <div className="menu-entries">
        <div className="menu-header">
          <IconButton className="menu-back" icon={BackIcon} onClick={() => this.setState({library: undefined})}>
            Menu
          </IconButton>
          <h4>{this.state.library.metadata.name}</h4>
        </div>

        { objects }
      </div>
    );
  }

  Libraries() {
    return (
      <AsyncComponent
        key="libraries-container"
        Load={this.props.menu.ListLibraries}
      >
        {
          Object.keys(this.props.menu.libraries).length === 0 ?
            <div className="menu-empty">No Libraries Available</div> :
            <div className="menu-entries">
              <ul>
                {
                  this.props.menu.libraries.map(library => {
                    const onClick = () => this.SelectLibrary(library);

                    return (
                      <li
                        tabIndex={0}
                        onKeyPress={onEnterPressed(onClick)}
                        onClick={onClick}
                        key={`library-${library.libraryId}`}
                      >
                        {library.metadata.name}
                      </li>
                    );
                  })
                }
              </ul>
            </div>
        }
      </AsyncComponent>
    );
  }

  Navigation() {
    if(this.state.objectId) {
      return this.SelectedObject();
    } if(this.state.library) {
      return this.Objects();
    } else {
      return this.Libraries();
    }
  }

  render() {
    if(!this.props.menu.showMenu) { return null; }

    return (
      <div className="menu-container">
        { this.Navigation() }
      </div>
    );
  }
}

export default Menu;
