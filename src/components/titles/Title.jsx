import TitleStyles from "@/assets/stylesheets/modules/titles.module.scss";

import {observer} from "mobx-react-lite";
import {useParams} from "wouter";
import React, {useEffect, useState} from "react";
import {titleStore} from "@/stores/index.js";
import {Icon, IconButton, Linkish, Loader, LoaderImage} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import UrlJoin from "url-join";

import BackIcon from "@/assets/icons/v2/back.svg";
import AIIcon from "@/assets/icons/v2/ai-sparkle1.svg";

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
      <div className={S("breadcrumbs")}>
        <IconButton
          icon={BackIcon}
          label="Back to Content"
          to={UrlJoin("~/titles/", queryB58 || "")}
          className={S("browser__header-back")}
        />
        <span>
          Back to Titles
        </span>
      </div>
      <div className={S("title")}>
        <div className={S("image-container")}>
          <LoaderImage
            showWithoutSource
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
    </div>
  );
});

export default Title;
