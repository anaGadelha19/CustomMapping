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
            $response = $this->api()->create('custom_mapping_feature_types', [
                'o:label' => $data['label'] ?? null,
                'o:color' => $data['color'] ?? null,
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
}
