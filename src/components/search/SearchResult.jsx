import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";
import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {Redirect, useParams} from "wouter";
import {rootStore, aiStore} from "@/stores/index.js";
import {IconButton, Linkish, Loader, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import UrlJoin from "url-join";
import Player from "@/components/common/Player.jsx";
import {ShareModal} from "@/components/download/Share.jsx";
import {DownloadModal} from "@/components/download/Download.jsx";
import {Tabs} from "@mantine/core";
import {AISearchBar} from "@/components/nav/Browser.jsx";

import BackIcon from "@/assets/icons/v2/back.svg";
import PlayIcon from "@/assets/icons/Play.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import ShareIcon from "@/assets/icons/v2/share.svg";
import PinIcon from "@/assets/icons/v2/pin.svg";
import RegenerateIcon from "@/assets/icons/rotate-ccw.svg";
import LinkIcon from "@/assets/icons/v2/external-link.svg";
import DownloadIcon from "@/assets/icons/v2/download.svg";


const S = CreateModuleClassMatcher(BrowserStyles, SearchStyles);

const ClipResultPanel = observer(({result}) => {
  const [showFull, setShowFull] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [summary, setSummary] = useState(false);

  useEffect(() => {
    if(!result?.objectId) { return; }

    aiStore.GenerateClipSummary({
      objectId: result.objectId,
      startTime: result.startTime,
      endTime: result.endTime
    })
      .then(summary => setSummary(summary));
  }, []);

  return (
    <>
      <div className={S("result")}>
        <div className={S("result__video-container")}>
          <Player
            key={`video-${showFull}`}
            objectId={result.objectId}
            playoutParameters={
              showFull ? {} :
                {
                  clipStart: result.startTime,
                  clipEnd: result.endTime
                }
            }
            playerOptions={
              !showFull ? {} :
                {
                  startTime: result.startTime
                }
            }
            className={S("result__video")}
          />
        </div>
        <div className={S("result__actions")}>
          <div className={S("result__actions--left")}>
            <StyledButton
              small
              icon={showFull ? ClipIcon : PlayIcon}
              onClick={() => setShowFull(!showFull)}
            >
              { showFull ? "Play Clip" : "Play Full Length" }
            </StyledButton>
            {
              showFull ? null :
                <div>
                  { result.subtitle }
                </div>
            }
          </div>
          <div className={S("result__actions--right")}>
            <StyledButton
              small
              variant="subtle"
              icon={PinIcon}
              to={UrlJoin("~/", result.objectId, "tags", `?st=${result.startTime}&et=${result.endTime}&isolate=`)}
            >
              Open in Tag Editor
            </StyledButton>
            <StyledButton
              small
              variant="subtle"
              icon={DownloadIcon}
              onClick={() => setShowDownloadModal(true)}
            >
              Download
            </StyledButton>
            <StyledButton
              small
              variant="subtle"
              icon={ShareIcon}
              onClick={() => setShowShareModal(true)}
            >
              Share
            </StyledButton>
          </div>
        </div>
        <div className={S("result__text")}>
          {
            !summary ? <Loader className={S("result__loader")} /> :
              <>
                <div className={S("result__title")}>
                  {summary.title}
                </div>
                <div className={S("result__summary")}>
                  { summary.summary }
                </div>
                <IconButton
                  disabled={!summary}
                  icon={RegenerateIcon}
                  onClick={async () =>
                    setSummary(
                      await aiStore.GenerateClipSummary({
                        objectId: result.objectId,
                        startTime: result.startTime,
                        endTime: result.endTime,
                        regenerate: true
                      })
                    )
                  }
                  className={S("result__regenerate-summary")}
                />
              </>
          }
        </div>
      </div>
      {
        !showShareModal ? null :
          <ShareModal
            alwaysOpened
            store={rootStore.searchVideoStore}
            onClose={() => setShowShareModal(false)}
          />
      }
      {
        !showDownloadModal ? null :
          <DownloadModal
            alwaysOpened
            store={rootStore.searchVideoStore}
            onClose={() => setShowDownloadModal(false)}
          />
      }
    </>
  );
});

const ImageResultPanel = observer(({result}) => {
  const [summary, setSummary] = useState(false);
  const [metadata, setMetadata] = useState(undefined);
  const [tab, setTab] = useState("summary");

  useEffect(() => {
    if(!result?.objectId) { return; }

    aiStore.client.ContentObjectMetadata({
      versionHash: result.versionHash,
      metadataSubtree: result.filePath
    })
      .then(metadata => setMetadata(metadata));

    aiStore.GenerateImageSummary({
      objectId: result.objectId,
      filePath: result.filePath
    })
      .then(summary => setSummary(summary));
  }, []);

  const titleKey = Object.keys(metadata?.display_metadata || {}).find(key =>
      ["headline", "title"].includes(key.toLowerCase())
  );
  const title = metadata?.display_metadata?.[titleKey];

  return (
    <div className={S("result")}>
      <div className={S("result__image-container")}>
        <img alt={title} src={result.imageUrl} className={S("result__image")}/>
        <IconButton
          href={result.imageUrl}
          target="_blank"
          faded
          icon={LinkIcon}
          label="View Asset"
          className={S("result__image-link")}
        />
      </div>
      <div className={S("result__tab-container")}>
        <Tabs mb="sm" value={tab} onChange={setTab} color="var(--text-secondary)">
          <Tabs.List fz={20} fw={800}>
            <Tabs.Tab px="xs" mr="sm" value="summary" className={tab !== "summary" ? S("tab--inactive") : ""}>
              Summary
            </Tabs.Tab>
            <Tabs.Tab px="xs" value="metadata" className={tab !== "metadata" ? S("tab--inactive") : ""}>
              Display Metadata
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <div className={S("result__tab-container--right")}>
          <StyledButton
            small
            variant="subtle"
            icon={PinIcon}
            to={UrlJoin("~/", result.objectId, "assets", aiStore.client.utils.B64(result.result.prefix.split("/").slice(-1)[0]))}
          >
            Open
          </StyledButton>
        </div>
      </div>
      <div className={S("result__text")}>
        {
          tab !== "summary" ? null :
            !summary ? <Loader className={S("result__loader")} /> :
              <>
                <div className={S("result__title")}>
                  {summary.title}
                </div>
                <div className={S("result__summary")}>
                  { summary.summary }
                </div>
                <IconButton
                  disabled={!summary}
                  icon={RegenerateIcon}
                  onClick={async () =>
                    setSummary(
                      await aiStore.GenerateImageSummary({
                        objectId: result.objectId,
                        filePath: result.filePath,
                        regenerate: true
                      })
                    )
                  }
                  className={S("result__regenerate-summary")}
                />
              </>
        }
        {
          tab !== "metadata" ? null :
            !metadata ? <Loader className={S("result__loader")} /> :
              <>
                {
                  !title ? null :
                    <div className={S("result__title")}>
                      {title}
                    </div>
                }
                <div className={S("result__display-metadata")}>
                  {
                    Object.keys(metadata.display_metadata || {}).map(key =>
                      <div key={`metadata-${key}`} className={S("result__metadata-field")}>
                        <label htmlFor={key}>{key}</label>
                        <div name={key}>{metadata.display_metadata[key]}</div>
                      </div>
                    )
                  }
                </div>
              </>
        }
      </div>
    </div>
  );
});

const SearchResult = observer(() => {
  let {queryB58, resultIndex} = useParams();
  const query = aiStore.client.utils.FromB58ToStr(queryB58);
  const result = aiStore.searchResults?.results?.[parseInt(resultIndex)];

  useEffect(() => {
    if(!result) { return; }

    if(aiStore.searchResults.type === "video") {
      rootStore.searchVideoStore.SetVideo({objectId: result.objectId})
        .then(() => rootStore.searchVideoStore.SetClipMark({inTime: result.startTime, outTime: result.endTime}));
    }
  }, [result]);

  if(!result) {
    return <Redirect to={`/${queryB58}`} />;
  }

  return (
    <div className={S("browser-page")}>
      <div className={S("browser")}>
        <AISearchBar basePath="/" initialQuery={query} />
        <h1 className={S("browser__header")}>
          <IconButton
            icon={BackIcon}
            label="Back to Results"
            to={UrlJoin("/", queryB58)}
            className={S("browser__header-back")}
          />
          <div>
            Search Results
          </div>
          <span className={S("browser__header-chevron")}>▶</span>
          <Linkish to={UrlJoin("/", queryB58)}>
            {query}
          </Linkish>
          <span className={S("browser__header-chevron")}>▶</span>
          <div>
            { result.name }
          </div>
        </h1>
        <div className={S("result-page")}>
          {
            result.type === "video" ?
              <ClipResultPanel result={result} /> :
              <ImageResultPanel result={result} />
          }
          {

          /*
          <PanelGroup direction="horizontal" className="panel-group">
            <Panel collapsible id="side-panel" order={1} minSize={30} defaultSize={40} >
              <SidePanel />
            </Panel>
            <PanelResizeHandle />
            <Panel id="content" order={2} minSize={30}>
              {
                result.type === "video" ?
                  <ClipResultPanel result={result} /> :
                  <ImageResultPanel result={result} />
              }
            </Panel>
          </PanelGroup>

           */
          }
        </div>
      </div>
    </div>
  );
});

export default SearchResult;
