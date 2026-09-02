import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect} from "react";
import {titleStore, videoStore} from "@/stores/index.js";
import {Loader} from "@mantine/core";
import {Synopsis} from "@/components/titles/Title.jsx";
import {CreateModuleClassMatcher, FormatTitleAttributes} from "@/utils/Utils.js";
import {IconButton, LoaderImage} from "@/components/common/Common.jsx";

import XIcon from "@/assets/icons/v2/x.svg";

const S = CreateModuleClassMatcher(TimelineStyles);

const SynopsisSection = observer(() => {
  const objectId = videoStore.videoObject?.objectId;
  const title = titleStore.titles[objectId];

  useEffect(() => {
    titleStore.LoadTitle({titleId: objectId});
  }, [objectId]);

  if(!title) { return <Loader />; }

  return (
    <div className={S("synopsis-section")}>
      {
        !title?.metadata?.images?.poster_vertical?.default ? null :
          <div className={S("synopsis-section__image-container")}>
            <LoaderImage
              src={title.metadata.images?.poster_vertical?.default?.url}
              loaderAspectRatio={2 / 3}
              className={S("synopsis-section__image")}
            />
          </div>
      }
      <div className={S("synopsis-section__info")}>
        <div className={S("synopsis-section__title")}>
          <span>{title.title}</span>
          <IconButton
            icon={XIcon}
            onClick={() => videoStore.ToggleShowSynopsisView(false)}
            title="Return to Timeline View"
          />
        </div>
        <div className={S("synopsis-section__attributes")}>
          <div className={S("synopsis-section__attributes-text")}>
            {FormatTitleAttributes(title.metadata.info)}
          </div>
        </div>
        {
          !title.metadata?.ai_derived_media?.topics ? null :
            <div className={S("synopsis-section__tags")}>
              {
                title.metadata.ai_derived_media.topics
                  .slice(0, 6)
                  .map(tag =>
                    <div key={tag} className={S("synopsis-section__tag")}>
                      {tag}
                    </div>
                  )
              }
            </div>
        }
        <Synopsis title={titleStore.titles[objectId]} initialSynopsisKey="oneliner"/>
      </div>
    </div>
  );
});

export default SynopsisSection;
