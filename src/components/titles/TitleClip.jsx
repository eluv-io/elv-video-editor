import TitleStyles from "@/assets/stylesheets/modules/titles.module.scss";

import {observer} from "mobx-react-lite";
import {useParams} from "wouter";
import React, {useEffect, useState} from "react";
import {titleStore} from "@/stores/index.js";
import {Icon, IconButton, Linkish, Loader} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import UrlJoin from "url-join";

import BackIcon from "@/assets/icons/v2/back.svg";
import AIIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import Player from "@/components/common/Player.jsx";
import TagSidebar from "@/components/titles/TagSidebar.jsx";

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

const Synopsis = observer(({title}) => {
  const [synopsisType, setSynopsisType] = useState("extended");

  return (
    <div className={S("synopsis")}>
      <div className={S("synopsis__type")}>
        <Icon icon={AIIcon} className={S("synopsis__icon")} />
        <div className={S("synopsis__title")}>
          Synopsis
        </div>
        <Linkish
          onClick={() => setSynopsisType("logline")}
          className={S("synopsis__type", synopsisType === "logline" ? "synopsis__type--active" : "")}
        >
          Logline (One Line)
        </Linkish>
        <Linkish
          onClick={() => setSynopsisType("marketing")}
          className={S("synopsis__type", synopsisType === "marketing" ? "synopsis__type--active" : "")}
        >
          Marketing (Paragraph)
        </Linkish>
        <Linkish
          onClick={() => setSynopsisType("extended")}
          className={S("synopsis__type", synopsisType === "extended" ? "synopsis__type--active" : "")}
        >
          Extended
        </Linkish>
      </div>
      <div key={synopsisType} className={S("synopsis__text")}>
        { dummyValues[`synopsis_${synopsisType}`] }
      </div>
    </div>
  );
});

const TitleClip = observer(() => {
  const {queryB58, titleId} = useParams();
  const title = titleStore.titles[titleId];

  useEffect(() => {
    titleStore.LoadTitle({titleId});

    return () => titleStore.SetPlayer(undefined);
  }, []);

  if(!title) {
    return <Loader />;
  }

  const clip = { type: "full", id: "full", title: title.title };

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
              key={`video-${clip.id}`}
              versionHash={title.versionHash}
              readyCallback={player => titleStore.SetPlayer(player)}
              playoutParameters={
                clip.type === "full" ? {} :
                  {
                    clipStart: clip.startTime,
                    clipEnd: clip.endTime
                  }
              }
              playerOptions={
                clip.type !== "full" ? {} :
                  {
                    startTime: clip.startTime
                  }
              }
              className={S("video")}
            />
            <div className={S("video-info")}>
              <div className={S("left")}>
                <div className={S("video-info__title")}>
                  { clip.title }
                </div>
              </div>
              <div className={S("right")}>
                <IconButton icon={BackIcon} />
              </div>
            </div>
          </div>
          <div className={S("info-section")}>
            <div className={S("info__tags")}>
              {
                dummyValues.tags.map(tag =>
                  <div key={tag} className={S("info__tag")}>
                    {tag}
                  </div>
                )
              }
            </div>
            <Synopsis title={title}/>
          </div>
        </div>
        <div className={S("sidebar-section")}>
          <TagSidebar
            title={title}
            clipInfo={clip}
          />
        </div>
      </div>

    </div>
  );
});

export default TitleClip;
