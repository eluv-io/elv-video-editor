import React, {useRef, useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {useDebouncedState} from "@mantine/hooks";

let scrollPreservationInfo = {};

// Infinite scroll
const InfiniteScroll = observer(({watchList=[], children, batchSize=10, scrollPreservationKey, Update, className=""}) => {
  const ref = useRef(null);
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
    Update(limit);

    if(!loaded && scrollPreservationInfo[scrollPreservationKey]?.scroll) {
      setTimeout(() =>
        ref.current.scrollTo(0, scrollPreservationInfo[scrollPreservationKey].scroll - 100),
        100
      );
    }

    setLoaded(true);
  }, [update]);

  useEffect(() => {
    if(!ref.current) { return; }

    const resizeObserver = new ResizeObserver(CheckUpdate);

    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  return (
    <div
      ref={ref}
      onScroll={CheckUpdate}
      className={className}
    >
      { children }
    </div>
  );
});

export default InfiniteScroll;
