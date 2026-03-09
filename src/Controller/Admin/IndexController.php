<?php
namespace CustomMapping\Controller\Admin;

use Laminas\Mvc\Controller\AbstractActionController;
use Laminas\View\Model\ViewModel;

class IndexController extends AbstractActionController
{
    protected function normalizeText($text)
    {
        $text = mb_strtolower((string) $text, 'UTF-8');
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if ($converted !== false) {
            $text = $converted;
        }
        return $text;
    }

    protected function isDateSemanticText($text)
    {
        $text = $this->normalizeText($text);
        return (bool) preg_match('/\b(date|data|year|ano|timeline|period|periodo|surveydate|visitdate|eventdate|chronolog|time|start|end|inicio|fim)\b/u', $text);
    }

    protected function looksLikeDateValue($value)
    {
        $value = trim((string) $value);
        if ($value === '') {
            return false;
        }
        if (preg_match('/^\d{4}$/', $value)) {
            return true;
        }
        return strtotime($value) !== false;
    }

    protected function extractTimelineDates($item)
    {
        if (!$item) {
            return [];
        }

        $knownDateTerms = ['dcterms:date'];

        $resourceTemplate = $item->resourceTemplate();
        if ($resourceTemplate) {
            foreach ($resourceTemplate->resourceTemplateProperties() as $rtProperty) {
                $property = $rtProperty->property();
                if (!$property) {
                    continue;
                }
                $term = $property->term();
                $label = $property->label();
                $alternateLabel = $rtProperty->alternateLabel();
                if (
                    $this->isDateSemanticText($term)
                    || $this->isDateSemanticText($label)
                    || $this->isDateSemanticText($alternateLabel)
                ) {
                    $knownDateTerms[] = $term;
                }
            }
        }

        foreach ($item->values() as $propertyData) {
            if (empty($propertyData['values']) || empty($propertyData['property'])) {
                continue;
            }

            $property = $propertyData['property'];
            $term = $property->term();
            $label = $property->label();
            $isDateProperty = in_array($term, $knownDateTerms, true)
                || $this->isDateSemanticText($term)
                || $this->isDateSemanticText($label);

            if (!$isDateProperty) {
                continue;
            }

            foreach ($propertyData['values'] as $value) {
                $rawValue = is_object($value) && method_exists($value, 'value')
                    ? $value->value()
                    : (string) $value;

                if ($this->looksLikeDateValue($rawValue)) {
                    return [trim((string) $rawValue)];
                }
            }
        }

        return [];
    }

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
            
            $item = $feature->item();
            $itemDates = $this->extractTimelineDates($item);
            
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
