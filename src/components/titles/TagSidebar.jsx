import SidebarStyles from "@/assets/stylesheets/modules/tag-sidebar.module.scss";

import React, {useEffect, useState} from "react";
import {titleStore} from "@/stores/index.js";
import {TextInput} from "@mantine/core";
import {observer} from "mobx-react-lite";
import {CreateModuleClassMatcher, useIsVisible} from "@/utils/Utils.js";
import {Icon} from "@/components/common/Common.jsx";

import AIDescriptionIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import SearchIcon from "@/assets/icons/v2/search.svg";

const S = CreateModuleClassMatcher(SidebarStyles);

export const FormatTime = time => {
  const useHours = time > 60 * 60;

  const hours = Math.floor(time / 60 / 60);
  const minutes = Math.floor(time / 60 % 60);
  const seconds = Math.floor(time % 60);

  let string = `${minutes.toString().padStart(useHours ? 2 : 1, "0")}:${seconds.toString().padStart(2, "0")}`;

  if(useHours) {
    string = `${hours.toString()}:${string}`;
  }

  return string;
};

const Tag = observer(({tag, showThumbnails, videoDimensions, active}) => {
  const [ref, setRef] = useState(undefined);
  const visible = useIsVisible(ref);
  const player = titleStore.player;

  return (
    <button
      ref={setRef}
      key={tag.id}
      id={`video-tag-${tag.id}`}
      onClick={() => {
        player?.controls.Seek({time: tag.start_time});
        player?.controls.Play();
      }}
      className={
        S(
          "tag",
          active ? "tag--active" : "",
          showThumbnails ? "tag--thumbnail" : ""
        )
      }
    >
      {
        !showThumbnails ? null :
          !visible ?
            <div
              key={`img-${tag.id}`}
              style={{
                aspectRatio: `${videoDimensions.width}/${videoDimensions.height}`
              }}
              className={S("tag__thumbnail")}
            /> :
            <img
              key={`img-${tag.id}`}
              style={{
                aspectRatio: `${videoDimensions.width}/${videoDimensions.height}`
              }}
              src={player.controls.GetThumbnailImage(tag.start_time)} alt={tag.tag}
              className={S("tag__thumbnail")}
            />
      }
      <div className={S("tag__text")}>
        <div className={S("tag__time")}>
          {
            showThumbnails ?
              `${ FormatTime(tag.start_time) } - ${ FormatTime(tag.end_time) } (${FormatTime(tag.end_time - tag.start_time)})` :
              FormatTime(tag.start_time)
          }
        </div>
        <div className={S("tag__content")}>
          {tag.tag}
        </div>
      </div>
    </button>
  );
});

let filterTimeout;
const FilterInput = observer(({filter, setFilter, placeholder}) => {
  const [filterInput, setFilterInput] = useState(filter);

  useEffect(() => {
    clearTimeout(filterTimeout);

    filterTimeout = setTimeout(() => setFilter(filterInput), 500);
  }, [filterInput]);

  useEffect(() => {
    setFilterInput(filterInput);
  }, [filter]);

  return (
    <TextInput
      value={filterInput}
      onChange={event => setFilterInput(event.target.value)}
      placeholder={placeholder}
      leftSectionWidth={50}
      leftSection={
        <Icon icon={SearchIcon} className={S("search__icon")}/>
      }
      classNames={{
        root: S("search"),
        input: [S("search__input"), "_title"].join(" ")
      }}
    />
  );
});

export const TagSidebar = observer(({title, clipInfo}) => {
  const [tab, setTab] = useState("TRANSCRIPT");
  const [containerRef, setContainerRef] = useState(undefined);
  const [activeTags, setActiveTags] = useState([]);
  const [filter, setFilter] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const player = titleStore.player;

  useEffect(() => {
    titleStore.LoadMediaTags({
      objectId: title.objectId,
      offering: clipInfo.offering,
      compositionKey: clipInfo.compositionKey,
      clipStart: clipInfo.clipStart,
      clipEnd: clipInfo.clipEnd
    })
      .then(() =>
        setTab(
          titleStore.mediaTags?.hasTranscription ? "TRANSCRIPT" :
            titleStore.mediaTags?.hasPlayByPlay ? "PLAY-BY-PLAY" : "CHAPTERS"
        )
      );
  }, [clipInfo]);

  useEffect(() => {
    setFilter("");
    setScrolled(false);
  }, [tab]);

  console.log(player);

  useEffect(() => {
    if(!player) { return; }

    setCurrentTime(player.controls.GetCurrentTime());

    const TimeUpdateDisposer = player.controls.RegisterVideoEventListener(
      "timeupdate",
      () => {
        setCurrentTime(player.controls.GetCurrentTime());
        setPlaying(player.controls.IsPlaying());
      }
    );

    return () => TimeUpdateDisposer?.();
  }, [player]);

  useEffect(() => {
    if(!containerRef || filter) { return; }

    const nearestCurrentTag = activeTags.find(tag => currentTime <= tag.end_time);

    if(!nearestCurrentTag) { return; }

    const tagElement = document.querySelector(`#video-tag-${nearestCurrentTag.id}`);

    if(!tagElement) { return; }

    if(
      tagElement.getBoundingClientRect().top - containerRef.getBoundingClientRect().top < 0 ||
      tagElement.getBoundingClientRect().bottom - containerRef.getBoundingClientRect().bottom > 0
    ) {
      containerRef.scrollTo({
        top: tagElement.offsetTop - 180,
        left: 0,
        behavior: scrolled ? "smooth" : "instant"
      });
      setScrolled(true);
    }
  }, [currentTime, activeTags.length]);

  useEffect(() => {
    if(!titleStore.mediaTags.hasTags) { return; }

    let tabTags = [];
    switch(tab) {
      case "TRANSCRIPT":
        tabTags = titleStore.mediaTags.transcriptionTags || [];
        break;
      case "PLAY-BY-PLAY":
        tabTags = titleStore.mediaTags.playByPlayTags || [];
        break;
      case "CHAPTERS":
        tabTags = titleStore.mediaTags.chapterTags || [];
    }

    setActiveTags(
      tabTags
        .filter(tag =>
          tag.tag.toLowerCase().includes(filter.toLowerCase())
        )
    );
  }, [tab, filter, !!titleStore.mediaTags?.hasTags, titleStore.mediaTags?.key]);

  if(!titleStore.mediaTags.hasTags) {
    return (
      <div className={S("sidebar")} />
    );
  }

  const tabs = [
    titleStore.mediaTags.hasTranscription ? "TRANSCRIPT" : "",
    titleStore.mediaTags.hasPlayByPlay ? "PLAY-BY-PLAY" : "",
    titleStore.mediaTags.hasChapters ? "CHAPTERS" : ""
  ]
    .filter(tab => tab);

  const showThumbnails = tab === "CHAPTERS" && player?.controls?.ThumbnailsAvailable();
  const videoDimensions = player?.controls.GetVideoDimensions();

  return (
    <div className={S("sidebar", "sidebar--tags")}>
      <div className={S("header")}>
        <div className={[S("header__title"), "_title"].join(" ")}>
          IN THIS VIDEO
          <Icon icon={AIDescriptionIcon} />
        </div>
      </div>
      <div className={S("tabs-container")}>
        <div className={S("tabs")}>
          {
            tabs.map(t =>
              <button
                onClick={() => setTab(t)}
                key={`tab-${t}`}
                className={S("tab", t === tab ? "tab--active" : "")}
              >
                {t}
              </button>
            )
          }
        </div>
      </div>
      <div className={S("search-container")}>
        <FilterInput
          placeholder={`SEARCH ${tab}`}
          filter={filter}
          setFilter={setFilter}
        />
      </div>
      <div
        key={`tags-${tab}`}
        className={S("tags")}
        ref={setContainerRef}
        style={{
          overflowY: playing && !filter ? "hidden" : "auto"
        }}
      >
        {
          activeTags.map(tag =>
            <Tag
              key={tag.id}
              tag={tag}
              active={currentTime >= tag.start_time && currentTime <= tag.end_time ? "tag--active" : ""}
              videoDimensions={videoDimensions}
              showThumbnails={showThumbnails}
            />
          )
        }
      </div>
    </div>
  );
});

export default TagSidebar;
