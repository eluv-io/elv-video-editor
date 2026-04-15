import TitleStyles from "@/assets/stylesheets/modules/titles.module.scss";

import {observer} from "mobx-react-lite";
import {Redirect, useParams} from "wouter";
import React, {useEffect, useState} from "react";
import {titleStore} from "@/stores/index.js";
import {CopyableField, Icon, IconButton, Linkish, Loader, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import UrlJoin from "url-join";
import Player from "@/components/common/Player.jsx";
import TagSidebar, {VerticalVideoSidebar} from "@/components/titles/TagSidebar.jsx";
import {TextInput} from "@mantine/core";

import BackIcon from "@/assets/icons/v2/back.svg";
import AIIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import VerticalIcon from "@/assets/icons/vertical.svg";
import {Synopsis} from "@/components/titles/Title.jsx";

const S = CreateModuleClassMatcher(TitleStyles);

const Summary = observer(({title, clipInfo}) => {
  if(!clipInfo.summary) { return; }

  return (
    <div className={S("summary")}>
      <div className={S("summary__header")}>
        <Icon icon={AIIcon} />
        Summary
      </div>
      <div className={S("summary__text")}>
        { clipInfo.summary }
      </div>
      <div className={S("summary__prompt-container")}>
        <TextInput
          leftSection={<Icon icon={AIIcon} />}
          placeholder="How would you like to personalize this?"
          className={S("summary__prompt")}
          classNames={{
            input: S("ai-text-input__input")
          }}
        />
      </div>
    </div>
  );
});

const ClipInfo = ({title, clipId}) => {
  if(clipId === "full") {
    return { type: "full", slug: "full", name: title.title };
  }

  const clipType = Object.keys(title.metadata.ai_derived_media || {})
    .find(clipType => title.metadata.ai_derived_media[clipType][clipId]);

  if(!clipType) { return; }

  return {
    type: clipType,
    slug: clipId,
    ...title.metadata.ai_derived_media[clipType][clipId]
  };
};

const TitleClip = observer(() => {
  const {queryB58, titleId, clipId} = useParams();
  const title = titleStore.titles[titleId];
  const [showVertical, setShowVertical] = useState(false);

  useEffect(() => {
    titleStore.LoadTitle({titleId});

    return () => titleStore.SetPlayer(undefined);
  }, []);

  if(!title) {
    return <Loader />;
  }

  const clipInfo = ClipInfo({title, clipId});

  if(!clipInfo) {
    return <Redirect to={UrlJoin("~/titles/", queryB58 || "", "title", titleId)} />;
  }

  return (
    <div className={S("title-page")}>
      <Linkish to={UrlJoin("~/titles/", queryB58 || "", "title", titleId)} className={S("breadcrumbs")}>
        <IconButton
          icon={BackIcon}
          className={S("browser__header-back")}
        />
        <span>
          Back to Title Info
        </span>
      </Linkish>
      <div className={S("clip-page")}>
        <div className={S("clip-section")}>
          <div className={S("video-section")}>
            <Player
              key={`video-${clipId}`}
              versionHash={title.versionHash}
              readyCallback={player => titleStore.SetPlayer(player)}
              playoutParameters={{
                vertical: clipInfo.type === "shorts",
                ...(
                  clipInfo.playout?.type === "composition" ?
                    {channel: clipInfo.playout.composition_key} :
                    clipInfo.playout?.type === "clip" ?
                      {
                        clipStart: clipInfo.playout.start / 1000,
                        clipEnd: clipInfo.playout.end / 1000
                      } : {}
                )
              }}
              playerOptions={{
                loadChapters: clipInfo.type === "full"
              }}
              className={S("video", clipInfo.type !== "full" && !clipInfo.summary ? "video--full" : "")}
            />
            <div className={S("video-info")}>
              <div className={S("left")}>
                <div>
                  <div className={S("video-info__title", "ellipsis")}>
                    { clipInfo.name }
                  </div>
                  <CopyableField value={titleId} className={S("video-info__id")}>
                    { titleId }
                  </CopyableField>
                </div>
              </div>
              <div className={S("right")}>
                <StyledButton
                  variant="rounded"
                  color="--text-secondary"
                  textColor="black"
                  size="md"
                  icon={VerticalIcon}
                  onClick={() => setShowVertical(true)}
                >
                  Make Vertical
                </StyledButton>
              </div>
            </div>
          </div>
          <div className={S("info-section")}>
            {
              !clipInfo.topics || clipInfo.topics.length === 0 ? null :
                <div className={S("info__tags")}>
                  {
                    clipInfo?.topics.map(tag =>
                      <div key={tag} className={S("info__tag")}>
                        {tag}
                      </div>
                    )
                  }
                </div>
            }
            {
              clipInfo.type === "full" ?
                <Synopsis title={title}/> :
                <Summary title={title} clipInfo={clipInfo} />
            }
          </div>
        </div>
        <div className={S("sidebar-section")}>
          {
            showVertical ?
              <VerticalVideoSidebar
                title={title}
                clipInfo={clipInfo}
                Close={() => setShowVertical(false)}
              /> :
              <TagSidebar
                title={title}
                clipInfo={clipInfo}
              />
          }
        </div>
      </div>

    </div>
  );
});

export default TitleClip;
