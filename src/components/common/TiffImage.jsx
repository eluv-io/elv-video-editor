import React, { useState } from "react";
import Tiff from "tiff.js";
import {Loader} from "@/components/common/Loader";

// Display TIFFs in browser - Not used, but may be useful

const TiffImage = ({url, setRef}) => {
  let [canvas, setCanvas] = useState(undefined);
  let [loading, setLoading] = useState(true);

  const LoadTiff = async (canvas, retries=0) => {
    try {
      const tiffData = await (await fetch(url)).arrayBuffer();
      const tiff = new Tiff({buffer: tiffData});
      const width = tiff.width();
      const height = tiff.height();
      const image = tiff.toCanvas().getContext("2d").getImageData(0, 0, width, height);

      canvas.width = image.width;
      canvas.height = image.height;

      canvas.getContext("2d").putImageData(image, 0, 0);

      setLoading(false);
    } catch(error) {
      if(retries < 5) {
        // First time you load a TIFF on the page fails for some reason, retry a few times
        await new Promise(resolve => setTimeout(resolve, 1000));

        await LoadTiff(canvas, retries+1);
      } else {
         
        console.error("Failed to load tiff: ");
         
        console.error(error);
      }
    }
  };

  return (
    <React.Fragment>
      <canvas
        className="tiff-canvas"
        ref={async element => {
          if(!element || canvas) { return; }

          setCanvas(element);

          await LoadTiff(element);

          if(setRef) {
            await new Promise(resolve => setTimeout(resolve, 250));

            setRef(element);
          }
        }}
      />
      { loading ? <Loader /> : null }
    </React.Fragment>
  );
};

export default TiffImage;
