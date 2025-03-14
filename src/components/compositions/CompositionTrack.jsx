import CompositionStyles from "@/assets/stylesheets/modules/compositions.module.scss";

import React, {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {compositionStore} from "@/stores/index.js";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Clip, DropIndicator} from "@/components/compositions/Clips.jsx";

const S = CreateModuleClassMatcher(CompositionStyles);

const CompositionTrack = observer(() => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({width: 0, height: 0});

  useEffect(() => {
    if(!containerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      setDimensions(containerRef.current.getBoundingClientRect());
    });

    resizeObserver.observe(containerRef.current);

    setDimensions(containerRef.current.getBoundingClientRect());

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  return (
    <div ref={containerRef} className={S("composition-track")}>
      <div className={S("composition-track__content")}>
        {
          compositionStore.clipList.map(clip =>
            <Clip
              key={`clip-${clip.clipId}`}
              clip={clip}
              containerDimensions={dimensions}
            />
          )
        }
        <DropIndicator containerDimensions={dimensions} />
      </div>
    </div>
  );
});

export default CompositionTrack;
