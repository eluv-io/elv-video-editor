import CommonStyles from "@/assets/stylesheets/modules/common.module.scss";

import React, {useRef, useEffect, useState} from "react";
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
  className=""
}) => {
  const ref = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [update, setUpdate] = useDebouncedState(0, 250);
  const [limit, setLimit] = useDebouncedState(
    scrollPreservationInfo[scrollPreservationKey]?.limit || batchSize,
    250
  );

  const CheckUpdate = () => {
    if(!ref?.current) { return; }

    if(ref.current.scrollTop + ref.current.offsetHeight > ref.current.scrollHeight * 0.86) {
      setLimit(limit + batchSize);
      setUpdate(update + 1);
    }

    if(loaded && scrollPreservationKey) {
      scrollPreservationInfo[scrollPreservationKey] = {
        limit,
        scroll: ref.current.scrollTop,
      };
    }
  };

  useEffect(() => {
    // Reset limit when tag content changes
    setLimit(batchSize);

    if(ref.current) {
      ref.current.scrollTop = 0;
    }

    setUpdate(update + 1);
  }, watchList);

  useEffect(() => {
    if(!loaded && scrollPreservationInfo[scrollPreservationKey]?.scroll) {
      setTimeout(() =>
          ref.current.scrollTo(0, scrollPreservationInfo[scrollPreservationKey].scroll - 100),
        100
      );
    }

    if(loading || (!loaded && children?.length > 0)) {
      setLoaded(true);
      return;
    }

    const updateTimeout = setTimeout(async () => {
      setLoading(true);

      await Update(limit);

      setLoading(false);
      setLoaded(true);
    }, 500);

    return () => clearTimeout(updateTimeout);
  }, [update]);

  useEffect(() => {
    if(!ref.current) { return; }

    const resizeObserver = new ResizeObserver(CheckUpdate);

    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  if(!loaded && withLoader) {
    return <Loader />;
  }

  if(loading && withLoader && (!children || children.length === 0)) {
    return <Loader className={S("infinite-scroll__loader")} />;
  }

  return (
    <div
      ref={ref}
      onScroll={CheckUpdate}
      className={className}
    >
      { children }
      {
        !loading || !withLoader ? null :
          <Loader className={S("infinite-scroll__loader")} />
      }
    </div>
  );
});

export default InfiniteScroll;
