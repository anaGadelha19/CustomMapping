<?php
namespace CustomMapping\Controller\Admin;

use Laminas\Mvc\Controller\AbstractActionController;
use Laminas\View\Model\JsonModel;

class TypeController extends AbstractActionController
{
    public function addAction()
    {
        if ($this->getRequest()->isPost()) {
            $data = $this->params()->fromPost();
            $color = $data['color'] ?? null;
            $colorNormalized = $color ? strtolower($color) : null;
            if ($colorNormalized) {
                $em = $this->getEvent()->getApplication()->getServiceManager()->get('Omeka\\EntityManager');
                $existingTypes = $em->getRepository('CustomMapping\\Entity\\MappingFeatureType')->findAll();
                foreach ($existingTypes as $existingType) {
                    if (strtolower((string) $existingType->getColor()) === $colorNormalized) {
                        return new JsonModel(['error' => 'duplicate_color']);
                    }
                }
            }
            $response = $this->api()->create('custom_mapping_feature_types', [
                'o:label' => $data['label'] ?? null,
                'o:color' => $colorNormalized,
            ]);
            if ($this->getRequest()->isXmlHttpRequest()) {
                $type = $response->getContent();
                return new JsonModel([
                    'id' => $type->id(),
                    'label' => $type->label(),
                    'color' => $type->color(),
                ]);
            }
        }
        return new JsonModel(['error' => 'Invalid request']);
    }

    public function deleteAction()
    {
        if ($this->getRequest()->isPost()) {
            $id = (int) ($this->params()->fromPost('id') ?? 0);
            if (!$id) {
                return new JsonModel(['error' => 'Missing id']);
            }

            try {
                $this->api()->delete('custom_mapping_feature_types', $id);
                return new JsonModel(['success' => true]);
            } catch (\Exception $e) {
                return new JsonModel(['error' => 'Delete failed']);
            }
        }

        return new JsonModel(['error' => 'Invalid request']);
    }

    public function updateAction()
    {
        if ($this->getRequest()->isPost()) {
            $id = (int) ($this->params()->fromPost('id') ?? 0);
            $color = $this->params()->fromPost('color');
            if (!$id || !$color) {
                return new JsonModel(['error' => 'Missing data']);
            }
            $colorNormalized = strtolower($color);

            try {
                $em = $this->getEvent()->getApplication()->getServiceManager()->get('Omeka\\EntityManager');
                $existingTypes = $em->getRepository('CustomMapping\\Entity\\MappingFeatureType')->findAll();
                foreach ($existingTypes as $existingType) {
                    if ((int) $existingType->getId() === $id) {
                        continue;
                    }
                    if (strtolower((string) $existingType->getColor()) === $colorNormalized) {
                        return new JsonModel(['error' => 'duplicate_color']);
                    }
                }
                $existing = $this->api()->read('custom_mapping_feature_types', $id)->getContent();
                $this->api()->update('custom_mapping_feature_types', $id, [
                    'o:label' => $existing->label(),
                    'o:color' => $colorNormalized,
                ]);
                return new JsonModel(['success' => true]);
            } catch (\Exception $e) {
                return new JsonModel(['error' => 'Update failed']);
            }
        }

        return new JsonModel(['error' => 'Invalid request']);
    }
}
