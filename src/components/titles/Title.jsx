import TitleStyles from "@/assets/stylesheets/modules/titles.module.scss";

import {observer} from "mobx-react-lite";
import {useParams} from "wouter";
import React, {useEffect, useState} from "react";
import {titleStore} from "@/stores/index.js";
import {CopyButton, Icon, IconButton, Linkish, Loader, LoaderImage} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher, Capitalize} from "@/utils/Utils.js";
import UrlJoin from "url-join";
import {Select, TextInput, Tooltip} from "@mantine/core";

import BackIcon from "@/assets/icons/v2/back.svg";
import AIIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import GenerateIcon from "@/assets/icons/rotate-ccw.svg";

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
  synopsis_social: "Jerry Maguire (Tom Cruise) is a top-tier sports agent at Sports Management International (SMI), living a life of superficial success—wealthy, charismatic, and engaged to the equally ambitious Avery Bishop. However, after a troubling encounter with the young son of an injured client, Jerry has a late-night crisis of conscience. He writes a 25-page \"mission statement\" (not a memo) titled The Things We Think and Do Not Say, calling for the agency to focus on fewer clients and more personal attention rather than just \"showing them the money.\"\n",
  synopsis_extended: "Jerry Maguire (Tom Cruise) is a top-tier sports agent at Sports Management International (SMI), living a life of superficial success—wealthy, charismatic, and engaged to the equally ambitious Avery Bishop. However, after a troubling encounter with the young son of an injured client, Jerry has a late-night crisis of conscience. He writes a 25-page \"mission statement\" (not a memo) titled The Things We Think and Do Not Say, calling for the agency to focus on fewer clients and more personal attention rather than just \"showing them the money.\"\n" +
    "While his colleagues initially give him a standing ovation, the reality of the business world quickly sets in. SMI sends Jerry’s protégé, Bob Sugar, to fire him. In a chaotic and legendary office scene, Jerry attempts to take his clients with him, but he is out-hustled. He leaves with only two things: the office goldfish and Dorothy Boyd (Renée Zellweger), a single mother and accountant who was moved by the idealism in his mission statement." +
    "While his colleagues initially give him a standing ovation, the reality of the business world quickly sets in. SMI sends Jerry’s protégé, Bob Sugar, to fire him. In a chaotic and legendary office scene, Jerry attempts to take his clients with him, but he is out-hustled. He leaves with only two things: the office goldfish and Dorothy Boyd (Renée Zellweger), a single mother and accountant who was moved by the idealism in his mission statement."
};

export const Synopsis = observer(({title}) => {
  const synopses = title.metadata.ai_derived_media?.synopses || {};
  const [synopsisType, setSynopsisType] = useState(
    Object.keys(synopses).includes("extended") ? "extended" : Object.keys(synopses)[0] || "extended"
  );

  return (
    <div className={S("synopsis")}>
      <div className={S("synopsis__type")}>
        <Icon icon={AIIcon} className={S("synopsis__icon")} />
        <div className={S("synopsis__title")}>
          Synopsis
        </div>
        <Linkish
          onClick={() => setSynopsisType("oneliner")}
          className={S("synopsis__type", synopsisType === "oneliner" ? "synopsis__type--active" : "")}
        >
          Logline (One Line)
        </Linkish>
        <Linkish
          onClick={() => setSynopsisType("sales")}
          className={S("synopsis__type", synopsisType === "sales" ? "synopsis__type--active" : "")}
        >
          Marketing (Paragraph)
        </Linkish>
        <Linkish
          onClick={() => setSynopsisType("extended")}
          className={S("synopsis__type", synopsisType === "extended" ? "synopsis__type--active" : "")}
        >
          Extended
        </Linkish>
        <Linkish
          onClick={() => setSynopsisType("social")}
          className={S("synopsis__type", synopsisType === "social" ? "synopsis__type--active" : "")}
        >
          Social
        </Linkish>
        <Linkish
          onClick={() => setSynopsisType("mood")}
          className={S("synopsis__type", synopsisType === "mood" ? "synopsis__type--active" : "")}
        >
          Mood
        </Linkish>
        <div className={S("synopsis__buttons")}>
          <CopyButton label="Copy synopsis" value={synopsisType} small />
          <IconButton
            icon={GenerateIcon}
            label={synopses[synopsisType] ? "Regenerate Synopsis" : "Generate Synopsis"}
            onClick={async () => titleStore.GenerateTitleSynopsis({objectId: title.objectId, style: synopsisType})}
            className={S("synopsis__button", "synopsis__button--generate")}
          />
        </div>
      </div>
      <div key={synopsisType} className={S("synopsis__text")}>
        { synopses[synopsisType] || "Not Generated" }
      </div>
    </div>
  );
});

const Clip = observer(({title, clipInfo, clipType}) => {
  const {queryB58, titleId} = useParams();

  const frameUrl = new URL(title.baseFrameUrl);

  if(clipType === "full" || clipInfo.playout?.type === "composition") {
    frameUrl.searchParams.set("t", parseInt(title.metadata.info.runtime * 60) / 2);
  } else {
    frameUrl.searchParams.set("t", clipInfo.playout.start / 1000 + (clipInfo.playout.end - clipInfo.playout.start) / 2 / 1000);
  }

  return (
    <Linkish
      to={UrlJoin("~/titles/", queryB58 || "", "title", titleId, "clip", clipInfo.slug)}
      className={S("clip", `clip--${clipType}`)}
    >
      <div className={S("clip__image-container")}>
        <LoaderImage
          src={frameUrl}
          showWithoutSource
          loaderAspectRatio={clipType === "shorts" ? 9/16 : 16/9}
          className={S("clip__image")}
        />
      </div>
      <Tooltip
        disabled={!clipInfo.summary}
        label={
          <div className={S("tooltip__item")}>
            <div className={S("tooltip__label")}>
              {clipInfo.name}
            </div>
            <div className={S("tooltip__content")}>
              <pre>
                {clipInfo.summary}
              </pre>
            </div>
          </div>
        }
      >
        <div className={S("clip__text")}>
          <div className={S("clip__title", "ellipsis")}>
            { clipInfo.name }
          </div>
          {
            !clipInfo.summary ? null :
              <div className={S("clip__subtitle", "ellipsis")}>
                { clipInfo.summary }
              </div>
          }
        </div>
      </Tooltip>
    </Linkish>
  );
});

const Clips = observer(({title}) => {
  const availableClipTypes = [...Object.keys(title.metadata.ai_derived_media || {}).sort(), "full"]
    .filter(key => titleStore.clipTypeKeys.includes(key));
  const initialClipType = sessionStorage.getItem("last-clip-type") || availableClipTypes[0];
  const [clipType, setClipType] = useState(
    availableClipTypes.includes(initialClipType) ? initialClipType : availableClipTypes[0]
  );

  useEffect(() => {
    sessionStorage.setItem("last-clip-type", clipType);
  }, [clipType]);

  const clips = clipType === "full" ? [{type: "full", slug: "full", name: title.title}] :
    Object.keys(title.metadata.ai_derived_media[clipType])
      .map(clipSlug => ({...title.metadata.ai_derived_media[clipType][clipSlug], slug: clipSlug}));

  return (
    <div className={S("clips")}>
      <div className={S("clips__options")}>
        <div className={S("left")}>
          <Select
            value={clipType}
            onChange={value => setClipType(value || clipType)}
            data={
              availableClipTypes.map(key => ({
                label: key === "full" ? "Full Content" : Capitalize(key),
                value: key
              }))
            }
            classNames={{
              input: S("rounded-select__input"),
            }}
          />
        </div>
        <div className={S("right")}>
          <TextInput
            leftSection={<Icon icon={AIIcon}/>}
            placeholder="Prompt to suggest content"
            w={400}
            classNames={{
              input: S("ai-text-input__input")
            }}
          />
        </div>
      </div>
      <div className={S("clips-list", `clips-list--${clipType}`)}>
        {
          clips.map(clipInfo =>
            <Clip
              key={`clip-${clipInfo.slug}`}
              title={title}
              clipType={clipType}
              clipInfo={clipInfo}
            />
          )
        }
      </div>
    </div>
  );
});

const GetAttributes = (info) => {
  let year = info.release_year || info.us_release_year;
  if(info.release_date) {
    year = new Date(info.release_date).getFullYear();
  }

  let rating = info.mpaa_rating;
  let runtime = info.runtime;
  if(runtime) {
    const hours = Math.floor(parseInt(runtime) / 60);
    const minutes = parseInt(runtime) % 60;

    runtime = hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  return [year, rating, runtime]
    .filter(a => a)
    .join(" • ");
};

const Title = observer(() => {
  const {queryB58, titleId} = useParams();
  const title = titleStore.titles[titleId];

  useEffect(() => {
    titleStore.LoadTitle({titleId});
  }, []);

  if(!title) {
    return <Loader />;
  }

  return (
    <div className={S("title-page")}>
      <Linkish to={UrlJoin("~/titles/", queryB58 || "")} className={S("breadcrumbs")}>
        <IconButton
          icon={BackIcon}
          className={S("browser__header-back")}
        />
        <span>
          Back to Titles
        </span>
      </Linkish>
      <div className={S("title")}>
        <div className={S("image-container")}>
          <LoaderImage
            src={title.metadata.images?.poster_vertical?.default?.url}
            loaderAspectRatio={2/3}
            className={S("image")}
          />
        </div>
        <div className={S("info")}>
          <div className={S("info__title")}>
            { title.title }
          </div>
          <div className={S("info__attributes")}>
            <div className={S("info__attributes-text")}>
              { GetAttributes(title.metadata.info) }
            </div>
            <Linkish
              to={UrlJoin("~/titles/", queryB58 || "", "title", titleId, "metadata")}
              className={S("info__metadata-link")}
            >
              All Metadata
            </Linkish>
          </div>
          <div className={S("info__tags")}>
            {
              dummyValues.tags.map(tag =>
                <div key={tag} className={S("info__tag")}>
                  {tag}
                </div>
              )
            }
          </div>
          <Synopsis title={title} />
          <div className={S("info__credits")}>
            {
              !title.metadata.info.talent.director ? null :
                <div className={S("info__credit")}>
                  <div className={S("info__credit-label")}>
                    Director
                  </div>
                  <div className={S("info__credit-value")}>
                    { title.metadata.info.talent.director.map(credit => credit.name).join(", ") }
                  </div>
                </div>
            }
            {
              !title.metadata.info.talent.written_by ? null :
                <div className={S("info__credit")}>
                  <div className={S("info__credit-label")}>
                    Writer
                  </div>
                  <div className={S("info__credit-value")}>
                    { title.metadata.info.talent.written_by.map(credit => credit.name).join(", ") }
                  </div>
                </div>
            }
          </div>
        </div>
      </div>
      <Clips title={title} />
    </div>
  );
});

export default Title;
