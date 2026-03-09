<?php
namespace CustomMapping\Controller\Admin;

use Laminas\Mvc\Controller\AbstractActionController;
use Laminas\View\Model\ViewModel;

class IndexController extends AbstractActionController
{
    public function getFeaturesAction()
    {
        $itemsQuery = json_decode($this->params()->fromQuery('items_query'), true);
        $itemsQuery = is_array($itemsQuery) ? $itemsQuery : [];

        $featuresQuery = json_decode($this->params()->fromQuery('features_query'), true);
        $featuresQuery = is_array($featuresQuery) ? $featuresQuery : [];
        $featuresQuery['page'] = max(1, (int) $this->params()->fromQuery('features_page', 1));
        $featuresQuery['per_page'] = 10000;

        // Prefer direct filters when available to avoid cross-module query hooks.
        if (!empty($itemsQuery['id'])) {
            $itemIds = $itemsQuery['id'];
            if (is_string($itemIds) && strpos($itemIds, ',') !== false) {
                $itemIds = array_values(array_filter(array_map('trim', explode(',', $itemIds)), 'strlen'));
            }
            $featuresQuery['item_id'] = $itemIds;
        } elseif (!empty($itemsQuery['item_set_id'])) {
            $featuresQuery['item_set_id'] = $itemsQuery['item_set_id'];
        } else {
            $itemsQuery['limit'] = 100000;
            $itemIds = $this->api()->search('items', $itemsQuery, ['returnScalar' => 'id'])->getContent();
            // An empty string would get all features, so set 0 if there are no items.
            $featuresQuery['item_id'] = $itemIds ? $itemIds : 0;
        }

        $featureResponse = $this->api()->search('custom_mapping_features', $featuresQuery);

        $features = [];
        foreach ($featureResponse->getContent() as $feature) {
            $featureType = $feature->featureType();
            $markerColor = $featureType ? $featureType->color() : $feature->markerColor();
            $featureTypeId = $featureType ? $featureType->id() : null;
            
            // Get dates from the item
            $itemDates = [];
            $item = $feature->item();
            if ($item) {
                $dateValues = $item->value('dcterms:date');
                if ($dateValues) {
                    if (!is_array($dateValues)) {
                        $dateValues = [$dateValues];
                    }
                    foreach ($dateValues as $dateValue) {
                        if (is_object($dateValue) && method_exists($dateValue, 'value')) {
                            $itemDates[] = $dateValue->value();
                        } else {
                            $itemDates[] = (string)$dateValue;
                        }
                    }
                }
            }
            
            $features[] = [
                $feature->id(),
                $feature->item()->id(),
                $feature->geography(),
                $markerColor,
                $featureTypeId,
                $itemDates,
            ];
        }

        return new \Laminas\View\Model\JsonModel($features);
    }

    public function getFeaturePopupContentAction()
    {
        $featureId = $this->params()->fromQuery('feature_id');
        $feature = $this->api()->read('custom_mapping_features', $featureId)->getContent();

        $view = new ViewModel;
        $view->setTerminal(true);
        $view->setTemplate('custom-mapping/admin/index/get-feature-popup-content');
        $view->setVariable('feature', $feature);
        return $view;
    }
}
