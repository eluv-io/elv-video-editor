import ListStyles from "@/assets/stylesheets/modules/lists.module.scss";

import {observer} from "mobx-react-lite";
import {CopyableField, Icon, Linkish, LoaderImage} from "@/components/common/Common.jsx";
import ImageIcon from "@/assets/icons/picture.svg";
import AnchorIcon from "@/assets/icons/v2/anchor.svg";
import {Menu, Tooltip} from "@mantine/core";
import {CreateModuleClassMatcher, SP} from "@/utils/Utils.js";
import React, {useState} from "react";
import MenuIcon from "@/assets/icons/v2/dots-vertical.svg";

const S = CreateModuleClassMatcher(ListStyles);

export const EntityCardMenu = observer(({label, actions}) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <Menu
      opened={showMenu}
      onChange={setShowMenu}
      shadow="md"
      position="top-start"
      zIndex={200}
    >
      <Menu.Target>
        <Tooltip label={label} disabled={showMenu} openDelay={500}>
          <button
            onClick={event => {
              event.stopPropagation();
              event.preventDefault();

              setShowMenu(!showMenu);
            }}
            className={S("entity-card__action", showMenu ? "entity-card__action--active" : "")}
          >
            <Icon icon={MenuIcon} />
          </button>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown p={0} w={200} bg="var(--background-toolbar)">
        <div className={S("card-menu")}>
          {
            actions.map(({label, icon, separator, ...action}, index) =>
              separator ?
                <div key={`separator-${index}`} className={S("card-menu__separator")} /> :
                <Linkish key={`action-${index}`} {...action} className={S("card-menu__item")}>
                  {
                    !icon ? null :
                      <Icon icon={icon} />
                  }
                  <span>{label}</span>
                </Linkish>
            )
          }
        </div>
      </Menu.Dropdown>
    </Menu>
  );
});

export const EntityListItem = observer(({
  link,
  image,
  label,
  subtitle,
  id,
  count,
  contain,
  anchor,
  small,
  actions,
  tooltip,
  aspectRatio="square"
}) =>
  <Linkish
    to={link}
    className={
      S(
        "entity-card",
        `entity-card--${aspectRatio}`,
        "entity-list-item",
        `entity-list-item--${aspectRatio}`,
        small ? "entity-list-item--small" : ""
      )
    }
  >
    <div className={S("entity-card__image-container")}>
      {
        !image ?
          <div className={S("entity-card__image", "entity-card__image--blank")}>
            <Icon icon={ImageIcon}/>
          </div> :
          <LoaderImage
            width={100}
            src={image}
            loaderDelay={25}
            loaderAspectRatio={aspectRatio === "landscape" ? 16/9 : 1}
            className={S("entity-card__image", contain ? "entity-card__image--contain" : "")}
          />
      }
      {
        !anchor ? null :
          <Icon icon={AnchorIcon} className={S("entity-card__image-badge")} />
      }
    </div>
    <div className={S("entity-card__text")}>
      <Tooltip position="top-start" openDelay={500} label={tooltip || label}>
        <div className={S("entity-card__title")}>
          <div className={S("ellipsis")}>
            {label}
          </div>
          {
            typeof count === "undefined" ? null :
              <div className={S("entity-card__count")}>({count})</div>
          }
        </div>
      </Tooltip>
      {
        !subtitle ? null :
          <div className={S("entity-card__subtitle")}>
            { subtitle }
          </div>
      }
      {
        !id ? null :
          <CopyableField value={id} showOnHover className={S("entity-card__id")}>
            {id}
          </CopyableField>
      }
    </div>
    <div onClick={SP()} className={S("entity-list-item__actions")}>
      { actions }
    </div>
  </Linkish>
);

export const EntityCard = observer(({
  link,
  image,
  label,
  subtitle,
  id,
  count,
  contain,
  anchor,
  actions,
  tooltip,
  aspectRatio="square"
}) => {
  return (
    <div className={S("entity-card", `entity-card--${aspectRatio}`)}>
      <Linkish
        to={link}
        className={S("entity-card__image-container")}
      >
        {
          !image ?
            <div className={S("entity-card__image", "entity-card__image--blank")}>
              <Icon icon={ImageIcon}/>
            </div> :
            <LoaderImage
              width={320}
              src={image}
              loaderDelay={25}
              loaderAspectRatio={aspectRatio === "landscape" ? 16/9 : 1}
              className={S("entity-card__image", contain ? "entity-card__image--contain" : "")}
            />
        }
        {
          !anchor ? null :
            <Icon icon={AnchorIcon} className={S("entity-card__image-badge")}/>
        }
      </Linkish>
      <div className={S("entity-card__text")}>
        <Tooltip openDelay={500} label={tooltip || label}>
          <div className={S("entity-card__title")}>
            <div className={S("ellipsis")}>
              {label}
            </div>
            {
              typeof count === "undefined" ? null :
                <div className={S("entity-card__count")}>({count})</div>
            }
          </div>
        </Tooltip>
        {
          !actions ? null :
            <div onClick={SP()} className={S("entity-card__actions")}>
              {actions}
            </div>
        }
      </div>
      {
        !subtitle ? null :
          <div className={S("entity-card__subtitle")}>
            {subtitle}
          </div>
      }
      {
        !id ? null :
          <CopyableField value={id} showOnHover className={S("entity-card__id")}>
            {id}
          </CopyableField>
      }
    </div>
  );
});
