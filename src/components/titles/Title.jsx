import TitleStyles from "@/assets/stylesheets/modules/titles.module.scss";

import {observer} from "mobx-react-lite";
import {useParams} from "wouter";
import React, {useEffect} from "react";
import {titleStore} from "@/stores/index.js";
import {Loader} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(TitleStyles);

const Title = observer(() => {
  const {titleId} = useParams();

  useEffect(() => {
    titleStore.LoadTitle({titleId});
  }, []);

  if(!titleStore.titles[titleId]) {
    return <Loader />;
  }

  return (
    <div className={S("title")}>
      Title
    </div>
  );
});

export default Title;
