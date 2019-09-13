import React from "react";
import {inject, observer} from "mobx-react";
import {AsyncComponent, onEnterPressed} from "elv-components-js";

import LoadingElement from "elv-components-js/src/components/LoadingElement";
import {BackButton} from "./Components";

@inject("menu")
@inject("video")
@observer
class Menu extends React.Component {
  constructor(props) {
    super(props);

    this.SelectLibrary = this.SelectLibrary.bind(this);
    this.SelectObject = this.SelectObject.bind(this);
  }

  async SelectLibrary(libraryId) {
    this.props.menu.SetLibraryId(libraryId);
  }

  async SelectObject(libraryId, objectId) {
    this.props.menu.SetLibraryId(libraryId);
    this.props.menu.SetObjectId(objectId);

    this.props.menu.ToggleMenu(false);
    this.setState({objectId});

    await this.props.menu.SelectVideo({libraryId, objectId});
  }

  SelectedObject() {
    const object = this.props.menu.selectedObject;

    const videoTags = this.props.video.videoTags.length === 0 ? null : (
      <React.Fragment>
        <label>Video Tags</label>
        <span className="wrap">{this.props.video.videoTags.join(", ")}</span>
      </React.Fragment>
    );

    return (
      <LoadingElement
        loading={!object}
        render={() => (
          <div className="menu-entries">
            <div className="menu-header">
              <BackButton onClick={this.props.menu.ClearObjectId} />
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

              { videoTags }
            </div>
          </div>
        )}
      />
    );
  }

  Objects() {
    const libraryId = this.props.menu.libraryId;
    const library = this.props.menu.libraries[libraryId];

    return (
      <AsyncComponent
        key="objects-container"
        Load={async () => await this.props.menu.ListObjects(libraryId)}
      >
        <div className="menu-entries">
          <div className="menu-header">
            <BackButton onClick={this.props.menu.ClearLibraryId} />
            <h4>{library ? library.metadata.name : ""}</h4>
          </div>
          {
            (this.props.menu.objects[libraryId] || []).length === 0 ?
              <div className="menu-empty">No Content Available</div> :
              <ul>
                {
                  (this.props.menu.objects[libraryId] || []).map(object => {
                    const onClick = () => this.SelectObject(libraryId, object.objectId);

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
        </div>
      </AsyncComponent>
    );
  }

  Libraries() {
    const libraries = Object.values(this.props.menu.libraries)
      .sort((a, b) => a.metadata.name.toLowerCase() > b.metadata.name.toLowerCase() ? 1 : -1);

    return (
      <AsyncComponent
        key="libraries-container"
        Load={this.props.menu.ListLibraries}
      >
        {
          libraries.length == 0 ?
            <div className="menu-empty">No Libraries Available</div> :
            <div className="menu-entries">
              <ul>
                {
                  libraries.map(library => {
                    const onClick = () => this.SelectLibrary(library.libraryId);

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
    if(this.props.menu.objectId) {
      return this.SelectedObject();
    } if(this.props.menu.libraryId) {
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
