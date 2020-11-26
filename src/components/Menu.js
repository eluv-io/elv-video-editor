import React from "react";
import {inject, observer} from "mobx-react";
import {AsyncComponent, IconButton, onEnterPressed} from "elv-components-js";

import LoadingElement from "elv-components-js/src/components/LoadingElement";
import {BackButton} from "./Components";

import PageBack from "../static/icons/Backward.svg";
import PageForward from "../static/icons/Forward.svg";

@inject("menu")
@inject("video")
@observer
class Menu extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      contentId: "",
      page: 1,
      perPage: 25,
      filter: "",
      filterInput: "",
      cacheId: "",
      count: 0
    };

    this.SelectLibrary = this.SelectLibrary.bind(this);
    this.SelectObject = this.SelectObject.bind(this);
  }

  async SelectLibrary(libraryId) {
    this.props.menu.SetLibraryId(libraryId);
  }

  async SelectObject(libraryId, objectId) {
    try {
      this.props.menu.SetLibraryId(libraryId);
      this.props.menu.SetObjectId(objectId);

      this.props.menu.ToggleMenu(false);

      await this.props.menu.SelectVideo({libraryId, objectId});
    } catch(error) {
      this.props.menu.ClearObjectId();
    }
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
              <BackButton
                onClick={() => {
                  this.props.menu.ClearObjectId();
                }}
              />
              <h4>{object.name}</h4>
            </div>

            <h5>{(object.metadata.public || {}).description}</h5>

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
      <div className="menu-entries">
        <div className="menu-header">
          <BackButton
            onClick={() => {
              this.props.menu.ClearLibraryId();
              this.setState({
                page: 1,
                filter: "",
                filterInput: "",
                count: 0,
                cacheId: ""
              });
            }}
          />
          <h4>{library ? library.name : ""}</h4>
          <div className="menu-page-controls">
            <IconButton
              hidden={this.state.page === 1}
              icon={PageBack}
              title="Previous Page"
              onClick={() => this.setState({page: this.state.page - 1})}
            />
            <span
              title="Current Page"
              hidden={this.state.count === 0}
              className="current-page"
            >
              {this.state.page} / {Math.ceil(this.state.count / this.state.perPage)}
            </span>
            <IconButton
              hidden={this.state.perPage * this.state.page > this.state.count}
              icon={PageForward}
              title="Next Page"
              onClick={() => this.setState({page: this.state.page + 1})}
            />
          </div>
        </div>

        <div className="menu-filter">
          <input
            placeholder="Filter..."
            value={this.state.filterInput}
            onChange={event => {
              this.setState({
                filterInput: event.target.value
              });

              clearTimeout(this.filterTimeout);

              this.filterTimeout = setTimeout(() => {
                this.setState({
                  page: 1,
                  filter: this.state.filterInput,
                  cacheId: "",
                  count: 0
                });
              }, 500);
            }}
          />
        </div>
        <AsyncComponent
          key={`objects-container-${this.state.filter}-${this.state.page}-${this.props.menu.showVideoOnly}`}
          Load={async () => {
            const paging = await this.props.menu.ListObjects({
              libraryId,
              page: this.state.page,
              perPage: this.state.perPage,
              filter: this.state.filter,
              cacheId: this.state.cacheId,
              count: 0
            });

            this.setState({count: paging.items, cacheId: paging.cache_id});
          }}
        >
          {
            (this.props.menu.objects[libraryId] || []).length === 0 ?
              <div className="menu-empty">No Content Available</div> :
              <ul>
                {
                  (this.props.menu.objects[libraryId] || [])
                    .sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)
                    .map(object => {
                      const onClick = () => this.SelectObject(libraryId, object.objectId);

                      return (
                        <li
                          tabIndex={0}
                          onClick={onClick}
                          onKeyPress={onEnterPressed(onClick)}
                          key={`content-object-${object.objectId}`}
                        >
                          { object.name }
                        </li>
                      );
                    })
                }
              </ul>
          }
        </AsyncComponent>
      </div>
    );
  }

  Libraries() {
    const libraries = Object.values(this.props.menu.libraries)
      .sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1);

    return (
      <div className="menu-entries">
        <div className="menu-header">
          <BackButton
            onClick={() => this.props.menu.ToggleMenu(false)}
          />
          <h4>Content Libraries</h4>
        </div>
        <div className="menu-filter content-lookup">
          <input
            placeholder="Find content by ID, version hash or contract address"
            value={this.state.contentId}
            onChange={event => this.setState({contentId: event.target.value})}
            onKeyPress={onEnterPressed(async () => {
              await this.props.menu.LookupContent(this.state.contentId);

              this.setState({contentId: ""});
            })}
          />
        </div>
        <AsyncComponent
          key="libraries-container"
          Load={this.props.menu.ListLibraries}
        >
          {
            libraries.length === 0 ?
              <div className="menu-empty">No Libraries Available</div> :
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
                        {library.name}
                      </li>
                    );
                  })
                }
              </ul>
          }
        </AsyncComponent>
      </div>
    );
  }

  Navigation() {
    if(this.props.menu.objectId) {
      return this.SelectedObject();
    } else if(this.props.menu.libraryId) {
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
