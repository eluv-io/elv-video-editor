import React, {useRef, useEffect} from "react";
import {observer} from "mobx-react-lite";
import {useDebouncedState} from "@mantine/hooks";

// Infinite scroll
const InfiniteScroll = observer(({watchList=[], children, batchSize=10, Update, className=""}) => {
  const ref = useRef(null);
  const [update, setUpdate] = useDebouncedState(0, 250);
  const [limit, setLimit] = useDebouncedState(batchSize, 250);

  const CheckUpdate = () => {
    if(!ref?.current) { return; }

    if(ref.current.scrollTop + ref.current.offsetHeight > ref.current.scrollHeight * 0.86) {
      setLimit(limit + batchSize);
      setUpdate(update + 1);
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
