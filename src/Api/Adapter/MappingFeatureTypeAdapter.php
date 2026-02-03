<?php
namespace CustomMapping\Api\Adapter;

use Omeka\Api\Adapter\AbstractEntityAdapter;
use Omeka\Api\Request;
use Omeka\Entity\EntityInterface;
use Omeka\Stdlib\ErrorStore;

class MappingFeatureTypeAdapter extends AbstractEntityAdapter
{
    public function getResourceName()
    {
        return 'custom_mapping_feature_types';
    }

    public function getRepresentationClass()
    {
        return 'CustomMapping\Api\Representation\MappingFeatureTypeRepresentation';
    }

    public function getEntityClass()
    {
        return 'CustomMapping\Entity\MappingFeatureType';
    }

    public function hydrate(Request $request, EntityInterface $entity, ErrorStore $errorStore)
    {
        if ($this->shouldHydrate($request, 'o:label')) {
            $entity->setLabel($request->getValue('o:label'));
        }
        if ($this->shouldHydrate($request, 'o:color')) {
            $entity->setColor($request->getValue('o:color'));
        }
    }

    public function validateEntity(EntityInterface $entity, ErrorStore $errorStore)
    {
        if (!$entity->getLabel()) {
            $errorStore->addError('o:label', 'A Mapping feature type must have a label.');
        }
        if (!$entity->getColor()) {
            $errorStore->addError('o:color', 'A Mapping feature type must have a color.');
        }
    }
}
