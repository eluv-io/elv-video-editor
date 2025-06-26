import GroundTruthStyles from "@/assets/stylesheets/modules/ground-truth.module.scss";
import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";

import {observer} from "mobx-react-lite";
import {Redirect, useLocation, useParams} from "wouter";
import React, {useEffect, useState} from "react";
import {groundTruthStore} from "@/stores/index.js";
import {Confirm, IconButton, Linkish, Loader, LoaderImage, StyledButton} from "@/components/common/Common.jsx";
import BackIcon from "@/assets/icons/v2/back.svg";
import UrlJoin from "url-join";
import {GroundTruthAssetFileBrowser, GroundTruthAssetForm} from "@/components/ground_truth/GroundTruthForms.jsx";

import {CreateModuleClassMatcher} from "@/utils/Utils.js";

import TrashIcon from "@/assets/icons/trash.svg";
import AnchorIcon from "@/assets/icons/v2/anchor.svg";
import ImageIcon from "@/assets/icons/picture.svg";
import EditIcon from "@/assets/icons/Edit.svg";

const S = CreateModuleClassMatcher(BrowserStyles, GroundTruthStyles);

const GroundTruthAsset = observer(() => {
  const [, navigate] = useLocation();
  const {poolId, entityId, assetIndexOrId} = useParams();

  // Force re-render when things change
  const [modifyIndex, setModifyIndex] = useState(0);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const pool = groundTruthStore.pools[poolId] || {};
  const entity = pool?.metadata?.entities?.[entityId];
  const asset = groundTruthStore.GetGroundTruthAsset(entity, assetIndexOrId, modifyIndex);
  const filename = asset?.link?.["/"]?.split("/")?.slice(-1)[0];

  useEffect(() => {
    if(!poolId) { return; }

    groundTruthStore.LoadGroundTruthPool({poolId});
  }, [poolId]);

  if(!pool?.metadata) {
    return <Loader />;
  }

  if(!asset) {
    return <Redirect to={UrlJoin("/", poolId, "entities", entityId)} />;
  }

  return (
    <>
      <div className={S("browser-page", "asset-page")}>
        <div className={S("browser")}>
          <h1 className={S("browser__header")}>
            <IconButton
              icon={BackIcon}
              label="Back to Ground Truth Entity"
              to={UrlJoin("/", poolId, "entities", entityId)}
              className={S("browser__header-back")}
            />
            <Linkish to="/">
              All Ground Truth
            </Linkish>
            <span className={S("browser__header-chevron")}>▶</span>
            <Linkish to={UrlJoin("/", poolId)}>
              {pool.name || pool.objectId}
            </Linkish>
            <span className={S("browser__header-chevron")}>▶</span>
            <Linkish to={UrlJoin("/", poolId, "entities", entityId)}>
              {entity?.label || entityId}
            </Linkish>
            <span className={S("browser__header-chevron")}>▶</span>
            <span>
              {asset?.label || filename || assetIndexOrId}
            </span>
          </h1>
          <div className={S("asset-page__content")}>
            <div className={S("asset-page__image-container")}>
              <LoaderImage
                src={asset?.link?.url}
                loaderDelay={0}
                loaderAspectRatio={1}
                className={S("asset-page__image")}
              />
            </div>
            <div className={S("asset-page__details")}>
              <div className={S("asset-page__title")}>
                { asset.label || asset.filename }
                <IconButton
                  small
                  faded
                  label="Modify Asset Details"
                  icon={EditIcon}
                  onClick={() => setShowEditForm(true)}
                  className={S("asset-page__edit")}
                />
              </div>
              <div className={S("asset-page__actions")}>
                <StyledButton
                  color="--background-active"
                  disabled={asset.anchor}
                  icon={AnchorIcon}
                  onClick={async () => {
                    await Confirm({
                      title: "Set Entity Anchor Image",
                      text: "Are you sure you want to use this asset as the anchor image for this entity?",
                      onConfirm: () => {
                        setModifyIndex(modifyIndex + 1);
                        groundTruthStore.SetAnchorAsset({poolId, entityId, assetIndexOrId});
                      }
                    });
                  }}
                >
                  Make Anchor
                </StyledButton>
                <StyledButton
                  color="--background-active"
                  icon={ImageIcon}
                  onClick={() => setShowFileBrowser(true)}
                >
                  Select Asset File
                </StyledButton>
                <StyledButton
                  color="--background-active"
                  icon={TrashIcon}
                  onClick={async () => {
                    await Confirm({
                      title: "Remove Ground Truth Asset",
                      text: "Are you sure you want to remove this asset?",
                      onConfirm: () => {
                        groundTruthStore.DeleteAsset({poolId, entityId, assetIndexOrId});
                        navigate(UrlJoin("/", poolId, "entities", entityId));
                      }
                    });
                  }}
                >
                  Delete Asset
                </StyledButton>
              </div>
            </div>
            {
              !asset.description ? null :
                <div className={S("asset-page__description")}>
                  { asset.description }
                </div>
            }
          </div>
        </div>
      </div>
      {
        !showFileBrowser ? null :
          <GroundTruthAssetFileBrowser
            poolId={poolId}
            entityId={entityId}
            assetIndexOrId={assetIndexOrId}
            Close={() => setShowFileBrowser(false)}
          />
      }
      {
        !showEditForm ? null :
          <GroundTruthAssetForm
            poolId={poolId}
            entityId={entityId}
            assetIndexOrId={assetIndexOrId}
            Close={() => setShowEditForm(false)}
          />
      }
    </>
  );
});

export default GroundTruthAsset;
