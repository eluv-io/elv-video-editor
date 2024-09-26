import BrowserStyles from "Assets/stylesheets/modules/browser.module.scss";

import React, {useState, useEffect, useRef} from "react";
import {observer} from "mobx-react";
import {browserStore} from "Stores";
import {CreateModuleClassMatcher} from "Utils/Utils";
import {IconButton, Loader} from "Components/common/Common";
import SVG from "react-inlinesvg";

import LibraryIcon from "Assets/icons/v2/library";
import ObjectIcon from "Assets/icons/file";
import VideoIcon from "Assets/icons/v2/video";
import BackIcon from "Assets/icons/v2/back";
import FirstPageIcon from "Assets/icons/DoubleBackward";
import LastPageIcon from "Assets/icons/DoubleForward";
import PageForwardIcon from "Assets/icons/Forward";
import PageBackIcon from "Assets/icons/Backward";


const S = CreateModuleClassMatcher(BrowserStyles);


const PageControls = observer(({currentPage, pages, maxSpread=15, SetPage}) => {
  const ref = useRef();

  const width = ref?.current?.getBoundingClientRect().width || rootStore.pageWidth;

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
    return null;
  }

  return (
    <div ref={ref} className={S("page-controls")}>
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

const SearchBar = observer(({filter, setFilter, delay=500}) => {
  const [updateTimeout, setUpdateTimeout] = useState(undefined);
  const [input, setInput] = useState(filter);

  useEffect(() => {
    clearTimeout(updateTimeout);

    setUpdateTimeout(
      setTimeout(() => {
        if(["ilib", "iq__", "hq__", "0x"].find(prefix => input.startsWith(prefix))) {
          browserStore.LookupContent(input)
            .then(result => {
              if(!result) {
                setFilter(input);
              }
            });
        } else {
          setFilter(input);
        }
      }, delay)
    );
  }, [input]);

  return (
    <input
      value={input}
      placeholder="Search"
      onChange={event => setInput(event.target.value)}
      className={S("search-bar")}
    />
  );
});

const BrowserTable = observer(({filter, Load, Select, defaultIcon, contentType="library"}) => {
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
          content.map(({id, name, image, duration, lastModified, forbidden}) =>
            <button
              key={`browser-row-${id}`}
              disabled={forbidden}
              onClick={() => Select(id)}
              className={S("browser-table__row", "browser-table__row--content")}
            >
              <div className={S("browser-table__cell")}>
                {
                  image ?
                    <img src={image} alt={name} className={S("browser-table__cell-image")}/> :
                    <SVG src={duration ? VideoIcon : defaultIcon} className={S("browser-table__cell-icon")}/>
                }
                <span>
                  {name}
                </span>
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
            </button>
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

const ObjectBrowser = observer(() => {
  const [filter, setFilter] = useState("");

  const library = browserStore.libraries[browserStore.libraryId];

  return (
    <div className={S("browser", "browser--object")}>
      <SearchBar filter={filter} setFilter={setFilter}/>
      <h1 className={S("browser__header")}>
        <IconButton
          icon={BackIcon}
          label="Back to Content Libraries"
          onClick={() => browserStore.SetLibraryId(undefined)}
          className={S("browser__header-back")}
        />
        <span>
          Content Libraries / {library?.name || browserStore.libraryId}
        </span>
      </h1>
      <BrowserTable
        filter={filter}
        defaultIcon={ObjectIcon}
        contentType="object"
        Load={async args => await browserStore.ListObjects(args)}
        Select={objectId => browserStore.SelectVideo({libraryId: browserStore.libraryId, objectId})}
      />
    </div>
  );
});

const LibraryBrowser = observer(() => {
  const [filter, setFilter] = useState("");

  return (
    <div className={S("browser", "browser--library")}>
      <SearchBar filter={filter} setFilter={setFilter}/>
      <h1 className={S("browser__header")}>
        Content Libraries
      </h1>
      <BrowserTable
        filter={filter}
        defaultIcon={LibraryIcon}
        contentType="library"
        Load={async args => await browserStore.ListLibraries(args)}
        Select={libraryId => browserStore.SetLibraryId(libraryId)}
      />
    </div>
  );
});

const Browser = observer(() => {
  return browserStore.libraryId ?
    <ObjectBrowser key={`browser-${browserStore.libraryId}`} />:
    <LibraryBrowser />;
});

export default Browser;