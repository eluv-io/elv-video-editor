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

let dummyValues = {
  attributes: ["1996", "R", "2h 19m"],
  tags: [
    "Feel-Good Romance",
    "Football",
    "Romantic Comedy",
    "Workplace Drama",
    "Comedy"
  ],
  synopsis_logline: "Jerry Maguire (Tom Cruise) is a top-tier sports agent at Sports Management International (SMI)",
  synopsis_marketing: "Jerry Maguire (Tom Cruise) is a top-tier sports agent at Sports Management International (SMI), living a life of superficial success—wealthy, charismatic, and engaged to the equally ambitious Avery Bishop. However, after a troubling encounter with the young son of an injured client, Jerry has a late-night crisis of conscience. He writes a 25-page \"mission statement\" (not a memo) titled The Things We Think and Do Not Say, calling for the agency to focus on fewer clients and more personal attention rather than just \"showing them the money.\"\n",
  synopsis_extended: "Jerry Maguire (Tom Cruise) is a top-tier sports agent at Sports Management International (SMI), living a life of superficial success—wealthy, charismatic, and engaged to the equally ambitious Avery Bishop. However, after a troubling encounter with the young son of an injured client, Jerry has a late-night crisis of conscience. He writes a 25-page \"mission statement\" (not a memo) titled The Things We Think and Do Not Say, calling for the agency to focus on fewer clients and more personal attention rather than just \"showing them the money.\"\n" +
    "While his colleagues initially give him a standing ovation, the reality of the business world quickly sets in. SMI sends Jerry’s protégé, Bob Sugar, to fire him. In a chaotic and legendary office scene, Jerry attempts to take his clients with him, but he is out-hustled. He leaves with only two things: the office goldfish and Dorothy Boyd (Renée Zellweger), a single mother and accountant who was moved by the idealism in his mission statement." +
    "While his colleagues initially give him a standing ovation, the reality of the business world quickly sets in. SMI sends Jerry’s protégé, Bob Sugar, to fire him. In a chaotic and legendary office scene, Jerry attempts to take his clients with him, but he is out-hustled. He leaves with only two things: the office goldfish and Dorothy Boyd (Renée Zellweger), a single mother and accountant who was moved by the idealism in his mission statement."
};

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
            <div className={S("info__tags")}>
              {
                (clipInfo?.topics || dummyValues.tags).map(tag =>
                  <div key={tag} className={S("info__tag")}>
                    {tag}
                  </div>
                )
              }
            </div>
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
