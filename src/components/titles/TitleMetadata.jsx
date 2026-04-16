import TitleStyles from "@/assets/stylesheets/modules/titles.module.scss";

import {observer} from "mobx-react-lite";
import {useParams} from "wouter";
import React, {useEffect} from "react";
import {titleStore} from "@/stores/index.js";
import {IconButton, Linkish, Loader} from "@/components/common/Common.jsx";
import {Capitalize, CreateModuleClassMatcher} from "@/utils/Utils.js";
import UrlJoin from "url-join";

import BackIcon from "@/assets/icons/v2/back.svg";

const S = CreateModuleClassMatcher(TitleStyles);

const ALL_CAPS = ["eidr", "mpaa", "mpm", "us", "id", "ip"];
const FormatKey = key => {
  const components = key.split("_");

  return components
    .map(component =>
      ALL_CAPS.includes(component.toLowerCase()) ?
        component.toUpperCase() :
        Capitalize(component)
    )
    .join(" ");
};

const TitleMetadata = observer(() => {
  const {titleId} = useParams();
  const title = titleStore.titles[titleId];

  useEffect(() => {
    titleStore.LoadTitle({titleId});
  }, []);

  if(!title) {
    return <Loader/>;
  }

  const info = {
    eidr: title.metadata.eidr,
    ip_title_id: title.metadata.ip_title_id,
    master_ip_title_id: title.metadata.master_ip_title_id,
    mpm_id: title.metadata.mpm_id,
    kit: title.metadata.kit,
    ...(title.metadata.info || {}),
  };

  const talentKeys = Object.keys(info?.talent || {})
    .filter(key => info.talent[key]?.[0]?.character_name)
    .sort();

  const additionalKeys = Object.keys(info?.talent || {})
    .filter(key => !info.talent[key]?.[0]?.character_name)
    .sort();

  return (
    <div className={S("title-page")}>
      <Linkish to={UrlJoin("~/titles/", titleId)} className={S("breadcrumbs")}>
        <IconButton
          icon={BackIcon}
          className={S("browser__header-back")}
        />
        <span>
          Back to Title Info
        </span>
      </Linkish>
      <div className={S("info__title")}>
        {title.title}
      </div>
      <div className={S("metadata")}>
        <div className={S("metadata__column")}>
          {
            Object.keys(info || {})
              .sort()
              .filter(key => info[key])
              .map(key =>
                key === "talent" ? null :
                  <div key={key} className={S("metadata__section")}>
                    <div className={S("metadata__item")}>
                      <div className={S("metadata__label")}>
                        {FormatKey(key)}
                      </div>
                      <div className={S("metadata__value")}>
                        {
                          Array.isArray(info[key]) ?
                            info[key].join(", ") :
                            info[key]
                        }
                      </div>
                    </div>
                  </div>
              )
          }
        </div>
        {
          talentKeys.length === 0 && additionalKeys.length === 0 ? null :
            <div className={S("metadata__column")}>
              {
                talentKeys.map(key =>
                  <div key={key} className={S("metadata__section", "metadata__section--multiple")}>
                    <div className={S("metadata__section-title")}>
                      {
                        key === "actor" ? "Cast" :
                          FormatKey(key)
                      }
                    </div>
                    {
                      info.talent[key]
                        .map(entry =>
                          key === "talent" ? null :
                            <div key={`${key}-${entry.name}`} className={S("metadata__item")}>
                              <div className={S("metadata__label")}>
                                {entry.character_name}
                              </div>
                              <div className={S("metadata__value")}>
                                {entry.name}
                              </div>
                            </div>
                        )
                    }
                  </div>
                )
              }
              {
                additionalKeys.length === 0 ? null :
                  <div className={S("metadata__section", "metadata__section--multiple")}>
                    <div className={S("metadata__section-title")}>
                      Additional Talent
                    </div>
                    {
                      additionalKeys.map(key =>
                        <div key={key} className={S("metadata__item")}>
                          <div className={S("metadata__label")}>
                            {FormatKey(key)}
                          </div>
                          <div className={S("metadata__value")}>
                            {
                              info.talent[key]
                                .map(entry => entry.name)
                                .join(", ")
                            }
                          </div>
                        </div>
                      )
                    }
                  </div>
              }
            </div>
        }
      </div>
    </div>
  );
});

export default TitleMetadata;
