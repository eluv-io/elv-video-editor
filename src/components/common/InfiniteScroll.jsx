import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {useDebouncedState} from "@mantine/hooks";
import {Loader} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

let scrollPreservationInfo = {};

const S = CreateModuleClassMatcher(CommonStyles);

// Infinite scroll
const InfiniteScroll = observer(({
  watchList=[],
  children,
  batchSize=10,
  scrollPreservationKey,
  Update,
  withLoader,
  showLoader,
  className=""
}) => {
  const [element, setElement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [update, setUpdate] = useDebouncedState(0, 250);
  const [initialScrollPosition] = useState(scrollPreservationInfo[scrollPreservationKey]?.scroll || 0);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [noScroll, setNoScroll] = useState(false);
  const [limit, setLimit] = useDebouncedState(
    (scrollPreservationKey && scrollPreservationInfo[scrollPreservationKey]?.limit) || batchSize,
    250
  );

  const CheckUpdate = () => {
    if(!element) { return; }

    if(element.scrollTop + element.offsetHeight > element.scrollHeight * 0.86) {
      setLimit(limit + batchSize);
      setUpdate(update + 1);
    }

    if(element.scrollHeight === element.clientHeight) {
      if(!noScroll) {
        setLimit(limit + batchSize);
        setUpdate(update + 1);
      }

      setNoScroll(true);
    }

    if(loaded && scrollPreservationKey) {
      scrollPreservationInfo[scrollPreservationKey] = {
        limit,
        scroll: element.scrollTop,
      };
    }
  };

  useEffect(() => {
    // Reset limit when tag content changes
    setLimit(batchSize);

    if(element) {
      element.scrollTop = 0;
    }

    setUpdate(update + 1);
  }, watchList);

  useEffect(() => {
    if(loading || (!loaded && children?.length > 0)) {
      setLoaded(true);
      return;
    }

    const updateTimeout = setTimeout(async () => {
      setLoading(true);

      await Update(limit, !initialLoadComplete);

      setLoading(false);
      setLoaded(true);
      setInitialLoadComplete(true);
    }, 500);

    return () => clearTimeout(updateTimeout);
  }, [update]);

  useEffect(() => {
    if(!element) { return; }

    if(initialScrollPosition) {
      element.scrollTo(0, initialScrollPosition);
    }

    const resizeObserver = new ResizeObserver(CheckUpdate);

    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [element]);

  if(!loaded && withLoader) {
    return <Loader />;
  }

  if(loading && withLoader && (!children || children.length === 0)) {
    return <Loader className={S("infinite-scroll__loader")} />;
  }

  return (
    <div
      ref={setElement}
      onScroll={CheckUpdate}
      className={className}
    >
      { children }
      {
        !showLoader && (!loading || !withLoader) ? null :
          <Loader className={S("infinite-scroll__loader")} />
      }
    </div>
  );
});

export default InfiniteScroll;
