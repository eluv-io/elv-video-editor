import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import React, {useState, useEffect} from "react";
import {observer} from "mobx-react-lite";
import {rootStore, browserStore, compositionStore} from "@/stores";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {IconButton, Linkish, Loader} from "@/components/common/Common";
import SVG from "react-inlinesvg";
import {Redirect} from "wouter";
import UrlJoin from "url-join";

import LibraryIcon from "@/assets/icons/v2/library.svg";
import ObjectIcon from "@/assets/icons/file.svg";
import VideoIcon from "@/assets/icons/v2/video.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import FirstPageIcon from "@/assets/icons/DoubleBackward.svg";
import LastPageIcon from "@/assets/icons/DoubleForward.svg";
import PageForwardIcon from "@/assets/icons/Forward.svg";
import PageBackIcon from "@/assets/icons/Backward.svg";

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

const SearchBar = observer(({filter, setFilter, delay=500, Select}) => {
  const [updateTimeout, setUpdateTimeout] = useState(undefined);
  const [input, setInput] = useState(filter);

  useEffect(() => {
    clearTimeout(updateTimeout);

    setUpdateTimeout(setTimeout(() => setFilter(input), delay));
  }, [input]);

  return (
    <input
      value={input}
      placeholder="Search"
      onChange={event => setInput(event.target.value)}
      onKeyDown={async event => {
        if(event.key !== "Enter") { return; }

        if(["ilib", "iq__", "hq__", "0x"].find(prefix => event.target.value.trim().startsWith(prefix))) {
          const result = await browserStore.LookupContent(event.target.value);

          Select?.(result);
        }
      }}
      className={S("search-bar")}
    />
  );
});

const BrowserTable = observer(({filter, Load, Select, defaultIcon, contentType="library", videoOnly}) => {
  const [loading, setLoading] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [content, setContent] = useState(undefined);
  const [paging, setPaging] = useState({page: 1, perPage: 10});

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
    LoadPage(1);
  }, [filter]);

  let table;
  if(showLoader) {
    table = (
      <div className={S("browser-table", "browser-table--loading")}>
        <Loader />
      </div>
    );
  } else {
    table = (
      <div className={S("browser-table", `browser-table--${contentType}`)}>
        <div className={S("browser-table__row", "browser-table__row--header")}>
          <div className={S("browser-table__cell", "browser-table__cell--header")}>
            Name
          </div>
          {
            contentType !== "object" ? null :
              <>
                <div
                  className={S("browser-table__cell", "browser-table__cell--header", "browser-table__cell--centered")}>
                  Duration
                </div>
                <div
                  className={S("browser-table__cell", "browser-table__cell--header", "browser-table__cell--centered")}>
                  Last Modified
                </div>
              </>
          }
        </div>
        {
          (content || []).map(({id, name, image, duration, isVideo, hasChannels, hasAssets, channels, lastModified, forbidden}) =>
            <Linkish
              onClick={() => {
                if(contentType === "library") {
                  Select({libraryId: id, name});
                } else if(contentType === "object") {
                  Select({objectId: id, name, isVideo, hasAssets, hasChannels, channels});
                } else {
                  Select({compositionKey: id});
                }
              }}
              key={`browser-row-${id}`}
              disabled={forbidden || (videoOnly && !isVideo)}
              className={S("browser-table__row", "browser-table__row--content")}
            >
              <div title={name} className={S("browser-table__cell")}>
                {
                  image ?
                    <img src={image} alt={name} className={S("browser-table__cell-image")}/> :
                    <SVG src={duration ? VideoIcon : defaultIcon} className={S("browser-table__cell-icon")}/>
                }
                {name}
              </div>
              {
                contentType !== "object" ? null :
                  <>
                    <div className={S("browser-table__cell", "browser-table__cell--centered")}>
                      {duration || "-"}
                    </div>
                    <div className={S("browser-table__cell", "browser-table__cell--centered")}>
                      {lastModified || "-"}
                    </div>
                  </>
              }
            </Linkish>
          )
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

const ChannelBrowser = observer(({channelInfo, Select, Back, className=""}) => {
  const [filter, setFilter] = useState("");

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
          {channelInfo.objectName} / Select Content
        </span>
      </h1>
      <BrowserTable
        filter={filter}
        defaultIcon={ObjectIcon}
        contentType="channels"
        Select={Select}
        Load={async ({page, perPage, filter}) => {
          const content = [
            {id: "", name: `Main Content - ${channelInfo.objectName}`},
            ...(channelInfo.channels.map(({key, name, label}) =>
              ({id: key, name: `Composition - ${name || label}`})
            ))
          ]
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
      />
    </div>
  );
});

export const ObjectBrowser = observer(({libraryId, title, Select, Path, Back, backPath, videoOnly, className=""}) => {
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
      <h1 className={S("browser__header")}>
        { title || "Content Libraries" }
      </h1>
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
  const [channelInfo, setChannelInfo] = useState(undefined);
  const [redirect, setRedirect] = useState(undefined);

  useEffect(() => {
    rootStore.SetPage("source");
  }, []);

  if(redirect) {
    return <Redirect to={redirect} />;
  }

  if(channelInfo) {
    return (
      <ChannelBrowser
        channelInfo={channelInfo}
        Back={() => setChannelInfo(undefined)}
        Select={({compositionKey}) => {
          compositionStore.Reset();
          setRedirect(
            compositionKey ?
              UrlJoin("/compositions", channelInfo.objectId, compositionKey) :
              UrlJoin("/", channelInfo.objectId)
          );
        }}
      />
    );
  }

  const Select = ({libraryId, objectId, name, isVideo, hasChannels, channels}) => {
    if(libraryId) {
      setSelectedLibraryId(libraryId);
    }

    if(!objectId) { return; }

    if(!isVideo) {
      setRedirect(UrlJoin("/", objectId, "assets"));
      return;
    }

    if(hasChannels) {
      setChannelInfo({
        libraryId: libraryId || selectedLibraryId,
        objectId,
        objectName: name,
        channels
      });
    } else {
      setRedirect(UrlJoin("/", objectId));
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

export default Browser;
