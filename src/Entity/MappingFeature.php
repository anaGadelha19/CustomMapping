<?php
namespace CustomMapping\Entity;

use LongitudeOne\Spatial\PHP\Types\Geography\GeographyInterface;
use Omeka\Entity\AbstractEntity;
use Omeka\Entity\Item;
use Omeka\Entity\Media;

/**
 * @Entity
 * @Table(name="custom_mapping_feature")
 */
class MappingFeature extends AbstractEntity
{
    /**
     * @Id
     * @Column(
     *     type="integer",
     *     options={
     *         "unsigned"=true
     *     }
     * )
     * @GeneratedValue(strategy="AUTO")
     */
    protected $id;

    /**
     * @ManyToOne(
     *     targetEntity="Omeka\Entity\Item",
     * )
     * @JoinColumn(
     *     nullable=false,
     *     onDelete="CASCADE"
     * )
     */
    protected $item;

    /**
     * @ManyToOne(
     *     targetEntity="Omeka\Entity\Media",
     * )
     * @JoinColumn(
     *     nullable=true,
     *     onDelete="SET NULL"
     * )
     */
    protected $media;

    /**
     * @Column(
     *     nullable=true
     * )
     */
    protected $label;

/**
     * @Column(
     *     nullable=true
     * )
     */
    protected $description;

/**
 * @Column(type="string", nullable=true)
 */
protected $markerColor;

    /**
     * @ManyToOne(
     *     targetEntity="CustomMapping\Entity\MappingFeatureType"
     * )
     * @JoinColumn(
     *     nullable=true,
     *     onDelete="SET NULL"
     * )
     */
    protected $featureType;

    /**
     * @Column(
     *     type="geography"
     * )
     */
    protected $geography;

    /**
     * @Column(
     *     type="text",
     *     nullable=true
     * )
     */
    protected $propertyIds;

    public function getId()
    {
        return $this->id;
    }

    public function setItem(Item $item)
    {
        $this->item = $item;
    }

    public function getItem()
    {
        return $this->item;
    }

    public function setMedia(?Media $media)
    {
        $this->media = $media;
    }

    public function getMedia()
    {
        return $this->media;
    }

    public function setLabel(?string $label)
    {
        $this->label = is_string($label) && '' === trim($label) ? null : $label;
    }

    public function getLabel()
    {
        return $this->label;
    }

     public function getDescription()
    {
        return $this->description;
    }

     public function setDescription(?string $description)
    {
        $this->description = is_string($description) && '' === trim($description) ? null : $description;
    }

    public function getMarkerColor(): ?string
    {
        return $this->markerColor;
    }

    public function setMarkerColor(?string $markerColor): void
    {
         $this->markerColor = $markerColor;
    }

    public function getFeatureType(): ?MappingFeatureType
    {
        return $this->featureType;
    }

    public function setFeatureType(?MappingFeatureType $featureType): void
    {
        $this->featureType = $featureType;
    }
    /**
     * Get geography.
     *
     * @return GeographyInterface
     */
    public function getGeography()
    {
        return $this->geography;
    }

    /**
     * Set geography.
     *
     * @param GeographyInterface $geography Geography to set
     */
    public function setGeography(GeographyInterface $geography)
    {
        $this->geography = $geography;
    }

    public function getPropertyIds(): array
    {
        if (!$this->propertyIds) {
            return [];
        }
        $decoded = json_decode($this->propertyIds, true);
        return is_array($decoded) ? $decoded : [];
    }

    public function setPropertyIds($propertyIds): void
    {
        if (is_string($propertyIds)) {
            $decoded = json_decode($propertyIds, true);
            $propertyIds = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($propertyIds)) {
            $propertyIds = [];
        }
        $propertyIds = array_values(array_filter($propertyIds, function ($id) {
            return is_numeric($id) || (is_string($id) && trim($id) !== '');
        }));
        $this->propertyIds = $propertyIds ? json_encode($propertyIds) : null;
    }
}
