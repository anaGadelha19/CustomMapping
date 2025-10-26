<?php
namespace CustomMapping\Service\BlockLayout;

use Interop\Container\ContainerInterface;
use CustomMapping\Site\BlockLayout\Map;
use CustomMapping\Site\BlockLayout\MapGroups;
use CustomMapping\Site\BlockLayout\MapQuery;
use Laminas\ServiceManager\Factory\FactoryInterface;

class MapFactory implements FactoryInterface
{
    public function __invoke(ContainerInterface $services, $requestedName, array $options = null)
    {
        switch ($requestedName) {
            case 'mappingMapGroups':
                $blockLayout = new MapGroups;
                $blockLayout->setFormElementManager($services->get('FormElementManager'));
                $blockLayout->setConnection($services->get('Omeka\Connection'));
                break;
            case 'mappingMapQuery':
                $blockLayout = new MapQuery;
                $blockLayout->setModuleManager($services->get('Omeka\ModuleManager'));
                $blockLayout->setFormElementManager($services->get('FormElementManager'));
                $blockLayout->setApiManager($services->get('Omeka\ApiManager'));
                break;
            case 'mappingMap':
                $blockLayout = new Map;
                $blockLayout->setModuleManager($services->get('Omeka\ModuleManager'));
                $blockLayout->setFormElementManager($services->get('FormElementManager'));
                break;
        }
        return $blockLayout;
    }
}
