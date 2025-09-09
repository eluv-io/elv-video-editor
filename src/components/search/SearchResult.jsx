import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";
import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {Redirect, useParams} from "wouter";
import {rootStore, aiStore} from "@/stores/index.js";
import {CopyableField, Icon, IconButton, Linkish, Loader, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import UrlJoin from "url-join";
import Player from "@/components/common/Player.jsx";
import {ShareModal} from "@/components/download/Share.jsx";
import {DownloadModal} from "@/components/download/Download.jsx";
import {Tabs} from "@mantine/core";
import {AISearchBar} from "@/components/nav/Browser.jsx";
import {Panel, PanelGroup, PanelResizeHandle} from "react-resizable-panels";
import {SearchResults} from "@/components/search/SearchResults.jsx";

import BackIcon from "@/assets/icons/v2/back.svg";
import PlayIcon from "@/assets/icons/Play.svg";
import ClipIcon from "@/assets/icons/v2/clip.svg";
import ShareIcon from "@/assets/icons/v2/share.svg";
import PinIcon from "@/assets/icons/v2/pin.svg";
import RegenerateIcon from "@/assets/icons/rotate-ccw.svg";
import LinkIcon from "@/assets/icons/v2/external-link.svg";
import DownloadIcon from "@/assets/icons/v2/download.svg";
import AIIcon from "@/assets/icons/v2/ai-sparkle1.svg";

import AIImageGray from "@/assets/images/composition-manual.svg";
import AIImageColor from "@/assets/images/composition-ai.svg";


const S = CreateModuleClassMatcher(BrowserStyles, SearchStyles);

const Summary = observer(({result}) => {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  const Generate = async ({cacheOnly, regenerate}={}) => {
    try {
      if(result.type === "video") {
        const summary = await aiStore.GenerateClipSummary({
          objectId: result.objectId,
          startTime: result.startTime,
          endTime: result.endTime,
          cacheOnly,
          regenerate
        });

        setSummary(summary);
      } else {
        setSummary(
          await aiStore.GenerateImageSummary({
            objectId: result.objectId,
            filePath: result.filePath,
            cacheOnly,
            regenerate
          })
        );
      }
    } catch(error) {
      setSummaryError(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(!result?.objectId) { return; }

    Generate({cacheOnly: true});
  }, []);

  if(
    loading ||
    (result.type === "video" && !rootStore.searchVideoStore?.videoObject?.metadata?.video_tags)
  ) { return null; }

  if(summaryError) {
    return (
      <div className={S("result__error")}>
        Summary could not be generated
      </div>
    );
  }

  if(!summary) {
    return (
      <button
        key={generating}
        onClick={() => {
          setGenerating(!generating);
          Generate();
        }}
        className={S("summary-box")}
      >
        <img
          alt="Summary Icon"
          src={generating ? AIImageGray : AIImageColor}
          className={S("summary-box__image", generating ? "summary-box__image--generating" : "")}
        />

        {
          !generating ?
            <div className={S("summary-box__text")}>
              <div className={S("summary-box__title")}>
                Create Summary with AI
              </div>
              <div className={S("summary-box__description")}>
                Let AI suggest a summary of this result. This may take a few seconds.
              </div>
            </div> :
            <div className={S("summary-box__text")}>
              <div className={S("summary-box__title")}>
                Generating...
              </div>
              <Loader className={S("summary-box__loader")} />
            </div>
        }
      </button>
    );
  }

  return (
    <div className={S("result__text")}>
      <div className={S("result__title")}>
        <Icon icon={AIIcon} className={S("result__icon")} />
        <span>{summary.title}</span>
      </div>
      <div className={S("result__summary")}>
        { summary.summary }
      </div>
      <IconButton
        disabled={!summary}
        icon={RegenerateIcon}
        onClick={async () => Generate({regenerate: true})}
        className={S("result__regenerate-summary")}
      />
    </div>
  );
});

const ClipResultPanel = observer(({result}) => {
  const [showFull, setShowFull] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

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
                <div className={S("result__time")}>
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
        <Summary result={result} />
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
      .then(summary => setSummary(summary))
      .catch(error => setSummaryError(error));
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
      {
        tab === "summary" ?
          <Summary result={result} /> :
          <div className={S("result__text")}>
            {
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
      }
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
  }, [result, queryB58, resultIndex]);

  if(!result) {
    return <Redirect to={`/${queryB58}`} />;
  }

  // Try and get 16:9 default size for video
  const contentRatio = 100 * ((window.innerHeight - 300) * 16 / 9) / (window.innerWidth - 85);

  return (
    <div key={`result-${queryB58}-${resultIndex}`} className={S("browser-page")}>
      <div className={S("browser")}>
        <AISearchBar basePath="/" initialQuery={query} />
        <h1 className={S("browser__header")}>
          <IconButton
            icon={BackIcon}
            label="Back to Results"
            to={UrlJoin("/", queryB58)}
            className={S("browser__header-back")}
          />
          <span>Search Results</span>
          <span className={S("browser__header-chevron")}>▶</span>
          <Linkish to={UrlJoin("/", queryB58)}>
            {query}
          </Linkish>
          <span className={S("browser__header-chevron")}>▶</span>
          <span className={S("browser__header-last")}>
            {result.name}
          </span>
          <div className={S("browser__header-right", "browser__id")}>
            <CopyableField value={result.objectId} className={S("browser__header-id")}>
              {result.objectId}
            </CopyableField>
          </div>
        </h1>
        <PanelGroup direction="horizontal" className={S("result-page")}>
          <Panel id="side-panel" order={1} minSize={25}>
            <SearchResults className={S("result-page__side-panel")} />
          </Panel>
          <PanelResizeHandle />
          <Panel id="content" order={2} minSize={30} defaultSize={contentRatio} >
              {
                result.type === "video" ?
                  <ClipResultPanel result={result} /> :
                  <ImageResultPanel result={result} />
              }
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
});

export default SearchResult;
