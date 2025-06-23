import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import React, {useState, useEffect} from "react";
import {observer} from "mobx-react-lite";
import {rootStore, browserStore, compositionStore, editStore, groundTruthStore} from "@/stores";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {
  AsyncButton,
  Confirm, CopyableField,
  FormSelect,
  FormTextInput,
  IconButton,
  Linkish,
  Loader, StyledButton
} from "@/components/common/Common";
import SVG from "react-inlinesvg";
import {Redirect} from "wouter";
import UrlJoin from "url-join";
import {Tabs, Tooltip} from "@mantine/core";

import LibraryIcon from "@/assets/icons/v2/library.svg";
import ObjectIcon from "@/assets/icons/file.svg";
import VideoIcon from "@/assets/icons/v2/video.svg";
import CompositionIcon from "@/assets/icons/v2/composition.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import FirstPageIcon from "@/assets/icons/DoubleBackward.svg";
import LastPageIcon from "@/assets/icons/DoubleForward.svg";
import PageForwardIcon from "@/assets/icons/Forward.svg";
import PageBackIcon from "@/assets/icons/Backward.svg";
import DeleteIcon from "@/assets/icons/trash.svg";
import XIcon from "@/assets/icons/v2/x.svg";
import GroundTruthIcon from "@/assets/icons/v2/ground-truth.svg";
import CreateIcon from "@/assets/icons/v2/add2.svg";
import {GroundTruthPoolForm} from "@/components/ground_truth/GroundTruthForms.jsx";

const S = CreateModuleClassMatcher(BrowserStyles);

const PageControls = observer(({currentPage, pages, maxSpread=15, SetPage}) => {
  const [ref, setRef] = useState(undefined);

  const width = ref?.getBoundingClientRect().width || 0;

  let spread = maxSpread;
  if(width < 600) {
    spread = Math.min(5, maxSpread);
  } else if(width < 1200) {
    spread = Math.min(9, maxSpread);
  }

  let spreadStart = Math.max(1, currentPage - Math.floor(spread / 2));
  const spreadEnd = Math.min(pages + 1, spreadStart + spread);
  spreadStart = Math.max(1, spreadEnd - spread);

  if(!pages || pages <= 1) {
    return <div className={S("page-controls")} />;
  }

  return (
    <div ref={setRef} style={width === 0 ? {opacity: 0} : {}} className={S("page-controls")}>
      <IconButton
        disabled={spreadStart <= 1}
        label="First Page"
        icon={FirstPageIcon}
        onClick={() => SetPage(1)}
        className={S("page-controls__button", "page-controls__button--arrow")}
      />
      <IconButton
        label="Previous Page"
        icon={PageBackIcon}
        disabled={currentPage <= 1}
        onClick={() => SetPage(currentPage - 1)}
        className={S("page-controls__button", "page-controls__button--arrow")}
      />
      {
        [...new Array(Math.max(1, spreadEnd - spreadStart))].map((_, index) => {
          const page = spreadStart + index;
          return (
            <IconButton
              key={`page-controls-${index}`}
              label={`Page ${page}`}
              disabled={page === currentPage}
              onClick={() => SetPage(page)}
              active={page === currentPage}
              className={S("page-controls__button")}
            >
              {page}
            </IconButton>
          );
        })
      }
      <IconButton
        label="Next Page"
        icon={PageForwardIcon}
        disabled={currentPage === pages}
        onClick={() => SetPage(currentPage + 1)}
        className={S("page-controls__button", "page-controls__button--arrow")}
      />
      <IconButton
        disabled={spreadEnd > pages}
        label="Last Page"
        icon={LastPageIcon}
        onClick={() => SetPage(pages)}
        className={S("page-controls__button", "page-controls__button--arrow")}
      />
    </div>
  );
});

export const SearchBar = observer(({filter, setFilter, delay=500, placeholder, Select}) => {
  const [updateTimeout, setUpdateTimeout] = useState(undefined);
  const [input, setInput] = useState(filter);

  useEffect(() => {
    clearTimeout(updateTimeout);

    setUpdateTimeout(setTimeout(() => setFilter(input), delay));
  }, [input]);

  return (
    <input
      value={input}
      placeholder={placeholder || "Title, Content ID, Version Hash"}
      onChange={event => setInput(event.target.value)}
      onKeyDown={async event => {
        if(!Select || event.key !== "Enter") { return; }

        if(["ilib", "iq__", "hq__", "0x"].find(prefix => event.target.value.trim().startsWith(prefix))) {
          const result = await browserStore.LookupContent(event.target.value);

          Select(result);
        }
      }}
      className={S("search-bar")}
    />
  );
});

export const BrowserTable = observer(({
  filter,
  Load,
  Select,
  defaultIcon,
  contentType="library",
  videoOnly,
  frameRate,
  noDuration,
  Delete
}) => {
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [content, setContent] = useState(undefined);
  const [paging, setPaging] = useState({page: 1, perPage: window.innerHeight < 900 ? 8 : 10});
  const [deleting, setDeleting] = useState(undefined);

  const LoadPage = page => {
    if(loading) { return; }

    setPaging({page, ...paging});

    setLoading(true);
    const loaderTimeout = setTimeout(() => setShowLoader(true), 500);

    Load({...paging, page, filter})
      .then(({content, paging}) => {
        setContent(content);
        setPaging(paging);
      })
      .finally(() => {
        clearTimeout(loaderTimeout);
        setLoading(false);
        setShowLoader(false);
      });
  };

  useEffect(() => {
    if(deleting) { return; }

    LoadPage(1);
  }, [filter, deleting]);

  let table;
  if(showLoader) {
    table = (
      <div className={S("browser-table", "browser-table--loading")}>
        <Loader/>
      </div>
    );
  } else {
    table = (
      <div className={S("browser-table", `browser-table--${contentType}`, noDuration ? `browser-table--${contentType}--no-duration` : "")}>
        <div className={S("browser-table__row", "browser-table__row--header")}>
          <div className={S("browser-table__cell", "browser-table__cell--header")}>
            Name
          </div>
          {
            !["object", "composition", "my-library", "ground-truth"].includes(contentType) ? null :
              <>
                {
                  noDuration ? null :
                    <div className={S("browser-table__cell", "browser-table__cell--header", "browser-table__cell--centered")}>
                      Duration
                    </div>
                }
                <div className={S("browser-table__cell", "browser-table__cell--header", "browser-table__cell--centered")}>
                  { ["object", "composition"].includes(contentType) ? "Last Modified" : "Last Accessed" }
                </div>
              </>
          }
          {
            !["composition", "my-library"].includes(contentType) ? null :
              <div className={S("browser-table__cell", "browser-table__cell--header")} />
          }
        </div>
        {
          (content || []).map(item => {
            if(!item) {
              // eslint-disable-next-line no-console
              console.warn("Browser table missing item", content);
              return null;
            }

            let disabled, message;
            if(deleting) {
              disabled = true;
            } else if(item.forbidden) {
              disabled = true;
              message = "You do not have access to this object";
            } else if(videoOnly && !item.isVideo) {
              disabled = true;
              message = "This object does not contain video";
            } else if(frameRate && item.frameRate !== frameRate) {
              disabled = true;
              message = "The framerate of this content is incompatible with the primary source of this composition";
            }

            return (
              <Linkish
                divButton
                onClick={() => {
                  if(contentType === "library") {
                    Select({libraryId: item.id, ...item});
                  } else if(contentType === "object") {
                    Select({objectId: item.id, ...item});
                  } else {
                    Select(item);
                  }
                }}
                key={`browser-row-${item.id || item.key || item.compositionKey}`}
                disabled={disabled}
                className={S("browser-table__row", "browser-table__row--content", disabled ? "browser-table__row--disabled" : "")}
              >
                <div className={S("browser-table__cell")}>
                  {
                    item.image ?
                      <img src={item.image} alt={item.name} className={S("browser-table__cell-image")}/> :
                      <SVG
                        src={
                          contentType === "ground-truth" ? GroundTruthIcon :
                            item.compositionKey ? CompositionIcon :
                              item.duration ?
                                VideoIcon : defaultIcon
                        }
                        className={S("browser-table__cell-icon")}
                      />
                  }
                  <div className={S("browser-table__row-title")}>
                    <Tooltip
                      label={
                        <div className={S("tooltip")}>
                          <div className={S("tooltip__item")}>
                            { item.name }
                          </div>
                          {
                            !message ? null :
                              <div className={S("tooltip__item")}>
                                { message }
                              </div>
                          }
                        </div>
                      }
                      openDelay={500}
                    >
                      <div className={S("browser-table__row-title-main")}>
                        <span className={S("ellipsis")}>
                          {item.name}{item.compositionKey ? " (Composition)" : ""}
                        </span>
                        {
                          !item.isLiveStream ? "" :
                            <span className={S("browser-table__live-tag", item.isLive ? "browser-table__live-tag--active" : "")}>
                              { item.isLive ? "LIVE" : "Live Stream" }
                            </span>
                        }
                      </div>
                    </Tooltip>
                    <div className={S("browser-table__row-title-id")}>
                      {
                        !["composition"].includes(contentType) ?
                          <CopyableField value={item.objectId || item.id} showOnHover>{item.id}</CopyableField> :
                          contentType !== "my-library" ? item.id :
                            `${item.objectId}${item.compositionKey ? ` - ${item.compositionKey}` : ""}`
                      }
                    </div>
                  </div>
                </div>
                {
                  !["object", "composition", "my-library", "ground-truth"].includes(contentType) ? null :
                    <>
                      {
                        noDuration ? null :
                          <div className={S("browser-table__cell", "browser-table__cell--centered")}>
                            {item.duration || "-"}
                          </div>
                      }
                      <div className={S("browser-table__cell", "browser-table__cell--centered")}>
                        {item.lastModified || "-"}
                      </div>
                    </>
                }
                {
                  !Delete || !item.id ? null :
                    <div className={S("browser-table__cell", "browser-table__cell--centered")}>
                      <IconButton
                        label="Remove Item"
                        icon={contentType === "my-library" ? XIcon : DeleteIcon}
                        faded
                        disabled={deleting}
                        onClick={async event => {
                          event.stopPropagation();
                          setDeleting(true);

                          try {
                            await Delete(item);
                          } finally {
                            setDeleting(false);
                          }
                        }}
                      />
                    </div>
                }
              </Linkish>
            );
          })
        }
      </div>
    );
  }

  if(!showLoader && (!content || content.length === 0)) {
    return (
      <div className={S("browser-table--empty")}>
        <div className={S("browser-table__message")}>
          No Results
        </div>
      </div>
    );
  }

  return (
    <div className={S("browser-table-container")}>
      {table}
      <PageControls
        currentPage={paging.page}
        pages={paging.pages}
        SetPage={page => LoadPage(page)}
      />
    </div>
  );
});

const CompositionBrowser = observer(({selectedObject, Select, Back, className=""}) => {
  const [filter, setFilter] = useState("");
  const [deletedChannels, setDeletedChannels] = useState([]);

  return (
    <div className={JoinClassNames(S("browser", "browser--channel"), className)}>
      <SearchBar filter={filter} setFilter={setFilter} Select={Select} />
      <h1 className={S("browser__header")}>
        <IconButton
          icon={BackIcon}
          label="Back to Content"
          onClick={Back}
          className={S("browser__header-back")}
        />
        <span>
          {selectedObject.name} / Select Content
        </span>
      </h1>
      <BrowserTable
        filter={filter}
        defaultIcon={VideoIcon}
        contentType="composition"
        Select={Select}
        Load={async ({page, perPage, filter}) => {
          const content = [
            {
              id: "",
              name: `Main Content - ${selectedObject.name}`,
              objectId: selectedObject.objectId,
              duration: selectedObject.duration,
              lastModified: selectedObject.lastModified
            },
            ...(selectedObject.channels.map(channel =>
              ({id: channel.compositionKey, name: `Composition - ${channel.name || channel.label}`, ...channel})
            ))
          ]
            .filter(({id}) => !deletedChannels.includes(id))
            // Filter duplicates
            .filter(({objectId, compositionKey}, i, s) =>
              i === s.findIndex(other => other.objectId === objectId && other.compositionKey === compositionKey)
            )
            .filter(({name}) => !filter || name.toLowerCase().includes(filter.toLowerCase()));

          const total = content.length;

          return {
            content: content.slice((page - 1) * perPage, page * perPage),
            paging: {
              page,
              pages: Math.ceil(total / perPage),
              perPage
            }
          };
        }}
        Delete={async ({id, name}) => await Confirm({
          title: "Delete Composition",
          text: `Are you sure you want to delete the composition '${name}'?`,
          onConfirm: async () => {
            await compositionStore.DeleteComposition({
              objectId: selectedObject.objectId,
              compositionKey: id
            });

            setDeletedChannels([...deletedChannels, id]);
          }})}
      />
    </div>
  );
});

export const ObjectBrowser = observer(({
  libraryId,
  title,
  Select,
  Path,
  Back,
  backPath,
  videoOnly,
  frameRate,
  noDuration,
  className=""
}) => {
  const [filter, setFilter] = useState("");

  useEffect(() => {
    // Ensure libraries are loaded
    browserStore.ListLibraries({});
  }, []);

  const library = browserStore.libraries?.[libraryId];

  return (
    <div className={JoinClassNames(S("browser", "browser--object"), className)}>
      <SearchBar filter={filter} setFilter={setFilter} Select={Select} />
      <h1 className={S("browser__header")}>
        <IconButton
          icon={BackIcon}
          label="Back to Content Libraries"
          to={backPath}
          onClick={Back}
          className={S("browser__header-back")}
        />
        <span>
          { title || `Content Libraries / ${library?.name || libraryId}` }
        </span>
      </h1>
      <BrowserTable
        filter={filter}
        defaultIcon={ObjectIcon}
        contentType="object"
        videoOnly={videoOnly}
        frameRate={frameRate}
        noDuration={noDuration}
        Path={Path}
        Select={Select}
        Load={async args => await browserStore.ListObjects({libraryId, ...args})}
      />
    </div>
  );
});

export const LibraryBrowser = observer(({title, Path, Select, className=""}) => {
  const [filter, setFilter] = useState("");

  return (
    <div className={JoinClassNames(S("browser", "browser--library"), className)}>
      <SearchBar filter={filter} setFilter={setFilter} Select={Select}/>
      {
        !title ? null :
          <h1 className={S("browser__header")}>
            { title || "Content Libraries" }
          </h1>
      }
      <BrowserTable
        filter={filter}
        defaultIcon={LibraryIcon}
        contentType="library"
        Select={Select}
        Path={Path}
        Load={async args => await browserStore.ListLibraries(args)}
      />
    </div>
  );
});

const Browser = observer(() => {
  const [selectedLibraryId, setSelectedLibraryId] = useState(undefined);
  const [selectedObject, setSelectedObject] = useState(undefined);
  const [redirect, setRedirect] = useState(undefined);

  useEffect(() => {
    rootStore.SetPage("source");
  }, []);

  if(redirect) {
    return <Redirect to={redirect} />;
  }

  if(selectedObject) {
    return (
      <CompositionBrowser
        selectedObject={selectedObject}
        Back={() => setSelectedObject(undefined)}
        Select={({objectId, compositionKey}) => {
          compositionStore.Reset();
          setRedirect(
            compositionKey ?
              UrlJoin("/compositions", objectId, compositionKey) :
              UrlJoin("/", objectId)
          );
        }}
      />
    );
  }

  const Select = (item) => {
    if(item.libraryId) {
      setSelectedLibraryId(item.libraryId);
    }

    if(!item.objectId) { return; }

    if(item.isLiveStream) {
      if(!item.vods || Object.keys(item.vods).length === 0) {
        // No vods, must create new
        browserStore.SetLiveToVodFormFields({
          liveStreamLibraryId: item.libraryId,
          liveStreamId: item.objectId
        });
        return;
      }

      setRedirect(UrlJoin("/", Object.keys(item.vods)[0]));
      return;
    }

    if(!item.isVideo) {
      setRedirect(UrlJoin("/", item.objectId, "assets"));
      return;
    }

    if(item.hasChannels) {
      setSelectedObject(item);
    } else {
      setRedirect(UrlJoin("/", item.objectId));
    }
  };

  if(selectedLibraryId) {
    return (
      <ObjectBrowser
        key={`browser-${selectedLibraryId}`}
        libraryId={selectedLibraryId}
        Back={() => setSelectedLibraryId(undefined)}
        Select={Select}
      />
    );
  }

  return <LibraryBrowser Select={Select} />;
});

export const GroundTruthPoolBrowser = observer(() => {
  const [filter, setFilter] = useState("");
  const [redirect, setRedirect] = useState(undefined);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if(redirect) {
    return <Redirect to={redirect} />;
  }

  const Select = ({id, objectId}) => {
    const pool = groundTruthStore.pools[id] || groundTruthStore.pools[objectId];

    if(!pool) { return; }

    setRedirect(UrlJoin("/", id || objectId));
  };

  return (
    <div className={S("browser-page")}>
      {
        !showCreateModal ? null :
          <GroundTruthPoolForm
            Close={poolId => {
              setShowCreateModal(false);

              if(poolId) {
                Select({objectId: poolId});
              }
            }}
          />
      }
      <div className={S("browser", "browser--ground-truth")}>
        <SearchBar filter={filter} setFilter={setFilter} Select={Select}/>
        <h1 className={S("browser__header")}>All Ground Truth</h1>
        <div className={S("browser__actions")}>
          <StyledButton
            icon={CreateIcon}
            onClick={() => setShowCreateModal(true)}
          >
            New
          </StyledButton>
        </div>
        <BrowserTable
          filter={filter}
          defaultIcon={ObjectIcon}
          contentType="ground-truth"
          noDuration
          Select={Select}
          Delete={async ({id, name}) => await Confirm({
            title: "Delete Ground Truth Pool",
            text: `Are you sure you want to delete the ground truth pool '${name}'? This action cannot be undone.`,
            onConfirm: async () => {
              await groundTruthStore.DeleteGroundTruthPool({
                objectId: id
              });
            }
          })}
          Load={async args => await browserStore.ListGroundTruthPools(args)}
        />
      </div>
    </div>
  );
});

const MyLibraryBrowser = observer(() => {
  const [filter, setFilter] = useState("");
  const [redirect, setRedirect] = useState(undefined);

  if(redirect) {
    return <Redirect to={redirect} />;
  }

  const Select = ({id, objectId, isVideo}) => {
    const item = browserStore.myLibraryItems.find(item => item.id === id) || (objectId ? {objectId, isVideo} : undefined);

    if(!item) { return; }

    if(item.compositionKey) {
      setRedirect(UrlJoin("/compositions", item.objectId, item.compositionKey));
    } else if(!item.isVideo) {
      setRedirect(UrlJoin("/", item.objectId, "assets"));
    } else {
      setRedirect(UrlJoin("/", item.objectId));
    }
  };

  return (
    <div className={S("browser", "browser--my-library")}>
      <SearchBar filter={filter} setFilter={setFilter} Select={Select} />
      <BrowserTable
        filter={filter}
        defaultIcon={ObjectIcon}
        contentType="my-library"
        Select={Select}
        Delete={async args => browserStore.RemoveMyLibraryItem(args)}
        Load={async args => await browserStore.ListMyLibrary(args)}
      />
    </div>
  );
});

const LiveToVodForm = observer(() => {
  const [libraries, setLibraries] = useState([]);
  const [streamDetails, setStreamDetails] = useState(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [redirect, setRedirect] = useState(undefined);

  useEffect(() => {
    if(!browserStore.liveToVodFormFields?.liveStreamId) { return; }

    Promise.all([
      browserStore.ObjectDetails({
        objectId: browserStore.liveToVodFormFields?.liveStreamId
      }),
      browserStore.ListLibraries({page: 1, perPage: 1000})
    ])
      .then(([info, libraries]) => {
        libraries = libraries.content || [];
        browserStore.SetLiveToVodFormFields({
          title: `${info.name} - VoD`,
          libraryId: libraries.find(library =>
            library?.name?.toLowerCase()?.includes("mezzanines")
          )?.id || browserStore.liveToVodFormFields.liveStreamLibraryId
        });

        setLibraries(libraries);
        setStreamDetails(info);
      });
  }, [browserStore.liveToVodFormFields?.liveStreamId]);

  if(redirect) {
    return <Redirect to={redirect} />;
  }

  if(!streamDetails) {
    return <Loader />;
  }

  return (
    <div className={S("ltv-form-container")}>
      <div className={S("ltv-form")}>
        <h1 className={S("ltv-form__header")}>
          <IconButton
            disabled={submitting}
            icon={BackIcon}
            label="Back"
            onClick={() => {
              browserStore.ClearLiveToVodFormFields();
            }}
          />
          <span>
            Create VoD from Live Stream
          </span>
        </h1>
        <div className={S("ltv-form__fields")}>
          <FormSelect
            disabled={submitting}
            label="Library"
            value={browserStore.liveToVodFormFields.libraryId}
            onChange={value => browserStore.SetLiveToVodFormFields({libraryId: value})}
            options={libraries.map((library) => ({
              value: library.id,
              label: library.name
            }))}
          />
          <FormTextInput
            disabled={submitting}
            label="Title"
            value={browserStore.liveToVodFormFields.title}
            onChange={event => browserStore.SetLiveToVodFormFields({title: event.target.value})}
          />
        </div>
        <div className={S("ltv-form__actions")}>
          {
            submitting ?
              <progress
                value={editStore.liveToVodProgress[browserStore.liveToVodFormFields.liveStreamId]}
                max={100}
                className={S("ltv-form__progress")}
              /> :
              <AsyncButton
                w={150}
                h={40}
                onClick={async () => {
                  setSubmitting(true);

                  try {
                    const vodObjectId = await editStore.RegenerateLiveToVOD({
                      liveObjectId: browserStore.liveToVodFormFields.liveStreamId,
                      title: browserStore.liveToVodFormFields.title,
                      vodObjectLibraryId: browserStore.liveToVodFormFields.libraryId
                    });

                    if(vodObjectId) {
                      setRedirect(UrlJoin("/", vodObjectId));
                    } else {
                      setSubmitting(false);
                    }
                  } catch(error) {
                    // eslint-disable-next-line no-console
                    console.error(error);
                    setSubmitting(false);
                  }
                }}
              >
                Create VoD
              </AsyncButton>
          }
        </div>
      </div>
    </div>
  );
});

const BrowserPage = observer(() => {
  const [tab, setTab] = useState("content");

  if(browserStore.liveToVodFormFields.liveStreamId) {
    return <LiveToVodForm />;
  }

  return (
    <div className={S("browser-page")}>
      <Tabs value={tab} onChange={setTab} color="var(--text-secondary)">
        <Tabs.List fz={24} fw={800}>
          <Tabs.Tab px="xl" value="content" className={tab !== "content" ? S("tab--inactive") : ""}>
            Content Libraries
          </Tabs.Tab>
          <Tabs.Tab px="xl" value="my-library" className={tab !== "my-library" ? S("tab--inactive") : ""}>
            My Library
          </Tabs.Tab>
        </Tabs.List>
        {
          tab === "content" ?
            <Browser/> :
            <MyLibraryBrowser/>
        }
      </Tabs>
    </div>
  );
});

export default BrowserPage;
