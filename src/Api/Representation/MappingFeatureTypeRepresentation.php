<?php
namespace CustomMapping\Api\Representation;

use Omeka\Api\Representation\AbstractEntityRepresentation;

class MappingFeatureTypeRepresentation extends AbstractEntityRepresentation
{
    public function getJsonLdType()
    {
        return 'o-module-mapping:FeatureType';
    }

    public function getJsonLd()
    {
        return [
            'o:label' => $this->label(),
            'o:color' => $this->color(),
        ];
    }

    public function label(): ?string
    {
        return $this->resource->getLabel();
    }

    public function color(): ?string
    {
        return $this->resource->getColor();
    }
}
