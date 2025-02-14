import React, {useRef, useEffect} from "react";
import {observer} from "mobx-react";
import {useDebouncedState} from "@mantine/hooks";

// Infinite scroll
const InfiniteScroll = observer(({watchList=[], children, batchSize=10, Update, className=""}) => {
  const ref = useRef(null);
  const [update, setUpdate] = useDebouncedState(0, 250);
  const [limit, setLimit] = useDebouncedState(batchSize, 250);

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

  return (
    <div
      ref={ref}
      onScroll={event => {
        if(event.currentTarget.scrollTop + event.currentTarget.offsetHeight > event.currentTarget.scrollHeight * 0.86) {
          setLimit(limit + batchSize);
          setUpdate(update + 1);
        }
      }}
      className={className}
    >
      { children }
    </div>
  );
});

export default InfiniteScroll;
