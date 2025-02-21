import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import {observer} from "mobx-react";
import {Linkish, LoaderImage} from "@/components/common/Common.jsx";
import UrlJoin from "url-join";
import {assetStore, rootStore} from "@/stores/index.js";
import React, {useEffect, useState} from "react";
import {useParams} from "wouter";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(SidePanelStyles);

const Asset = observer(({asset, selected}) => {
  return (
    <Linkish
      to={UrlJoin("/assets", rootStore.client.utils.B64(asset.key))}
      onClick={() => rootStore.SetExpandedPanel(undefined)}
      className={S("asset", selected ? "asset--selected" : "")}
    >
      <LoaderImage
        lazy={false}
        loaderDelay={0}
        loaderAspectRatio={1}
        src={assetStore.AssetLink(asset.key, {width: 400})}
        className={S("asset__image")}
      />
      <div className={S("asset__name")}>
        { asset.key }
      </div>
    </Linkish>
  );
});

const AssetsList = observer(() => {
  const [assets, setAssets] = useState([]);
  const [limit, setLimit] = useState(0);
  const [totalAssets, setTotalAssets] = useState(0);

  const { assetKey } = useParams();

  useEffect(() => {
    rootStore.SetExpandedPanel("sidePanel");
  }, []);

  return (
    <>
      <div className={S("count")}>
        {
          totalAssets === 0 ?
            "No assets found" :
            `Showing 1 - ${limit} of ${totalAssets}`
        }
      </div>
      <InfiniteScroll
        watchList={[
          assetStore.filter,
          Object.keys(assetStore.activeTracks).length
        ]}
        batchSize={60}
        className={S("assets")}
        Update={limit => {
          const assets = assetStore.filteredAssetList;
          setAssets(assets.slice(0, limit));
          setTotalAssets(assets.length);
          setLimit(Math.min(assets.length, limit));
        }}
      >
        {
          assets.map(asset =>
            <Asset
              selected={
                asset.key === assetKey ||
                (assetKey && asset.key === rootStore.client.utils.FromB64(assetKey))
              }
              asset={asset}
              key={asset.key}
            />
          )
        }
      </InfiniteScroll>
    </>
  );
});

export default AssetsList;
