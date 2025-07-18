import React, {forwardRef, useEffect, useRef, useState} from "react";
import {rootStore} from "@/stores/index.js";
import {EluvioPlayerParameters, InitializeEluvioPlayer} from "@eluvio/elv-player-js/lib/index";

const Player = forwardRef(function VideoComponent({
  objectId,
  versionHash,
  contentInfo={},
  playerOptions={},
  playoutParameters={},
  callback,
  readyCallback,
  errorCallback,
  settingsUpdateCallback,
  hideControls,
  showTitle,
  mute,
  autoAspectRatio=true,
  className="",
  containerProps
}, ref) {
  const [videoDimensions, setVideoDimensions] = useState(undefined);
  const [player, setPlayer] = useState(undefined);
  const targetRef = useRef();

  useEffect(() => {
    if(!targetRef || !targetRef.current || !(objectId || versionHash)) { return; }

    if(player) {
      try {
        player.Destroy();
        setPlayer(undefined);
      } catch(error) {
        // eslint-disable-next-line no-console
        console.log(error);
      }
    }

    const initTimeout = setTimeout(() => {
      InitializeEluvioPlayer(
        targetRef.current,
        {
          clientOptions: {
            client: rootStore.client
          },
          sourceOptions: {
            contentInfo,
            playoutParameters: {
              objectId,
              versionHash,
              ...playoutParameters,
            },
          },
          playerOptions: {
            muted: EluvioPlayerParameters.muted[mute ? "ON" : "OFF"],
            controls: EluvioPlayerParameters.controls[hideControls === "off_with_volume_toggle" ? "OFF_WITH_VOLUME_TOGGLE" : (hideControls ? "OFF" : "AUTO_HIDE")],
            title: EluvioPlayerParameters.title[showTitle ? "ON" : "FULLSCREEN_ONLY"],
            //maxBitrate: 50000,
            ui: EluvioPlayerParameters.ui.WEB,
            appName: "video-editor",
            backgroundColor: "black",
            autoplay: EluvioPlayerParameters.autoplay.ON,
            watermark: EluvioPlayerParameters.watermark.OFF,
            verifyContent: EluvioPlayerParameters.verifyContent.ON,
            errorCallback,
            ...playerOptions
          }
        }
      ).then(player => {
        if(!window.players) {
          window.players = {};
        }

        window.players[versionHash || objectId] = player;

        setPlayer(player);

        player.controls.RegisterVideoEventListener("canplay", event => {
          setVideoDimensions({width: event.target.videoWidth, height: event.target.videoHeight});
          readyCallback && readyCallback(player);
        });

        if(settingsUpdateCallback) {
          player.controls.RegisterSettingsListener(() => settingsUpdateCallback(player));
        }

        if(callback) {
          callback(player);
        }
      });
    }, 100);

    return () => clearTimeout(initTimeout);
  }, [targetRef, objectId, versionHash]);

  useEffect(() => {
    if(player) {
      player.playerOptions.controls = EluvioPlayerParameters.controls[hideControls ? "OFF" : "AUTO_HIDE"];
      player.playerOptions.title = EluvioPlayerParameters.title[showTitle ? "ON" : "FULLSCREEN_ONLY"];

      if(mute) {
        player.__wasMuted = player.controls.IsMuted();
        player.controls.Mute();
      } else if(!player.__wasMuted) {
        player.controls.Unmute();
      }
    }
  }, [hideControls, showTitle, mute]);

  useEffect(() => {
    return () => {
      if(!player) { return; }

      try {
        player.Destroy();
        delete window.players?.[versionHash || objectId];
      } catch(error) {
        // eslint-disable-next-line no-console
        console.log(error);
      }
    };
  }, [player]);

  return (
    <div
      {...(containerProps || {})}
      ref={ref}
      className={className}
      style={
        !autoAspectRatio ? containerProps?.style || {} :
          {
            ...(containerProps?.style || {}),
            aspectRatio: `${videoDimensions?.width || 16} / ${videoDimensions?.height || 9}`
          }
      }
    >
      <div ref={targetRef} />
    </div>
  );
});

export default Player;
